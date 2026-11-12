/**
 * "Servidor" que corre dentro del navegador: atiende las llamadas /api/* usando
 * exactamente las mismas rutas y servicios que el backend Node, con la base de datos
 * guardada en este dispositivo.
 */
import publicRoutes from '../routes/public.ts';
import adminRoutes from '../routes/admin.ts';
import { ensureSystemBootstrap } from '../services/bootstrap.ts';
import { destroyDemoDatabase, ownership } from './browser-db.ts';
import { ShimResponse, type ShimRequest } from './express-shim.ts';

let ready: Promise<void> | null = null;

/*
 * Varias pestañas: la pestaña activa es la dueña de la base (ver browser-db.ts). Si esta pestaña
 * la perdió porque se usó otra, se recarga al volver a ella para mostrar los datos al día.
 */
function reloadIfLost() {
  if (ownership.lost && !document.hidden) window.location.reload();
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', reloadIfLost);
  window.addEventListener('focus', reloadIfLost);
}

const listeners = new Set<(state: 'loading' | 'ready' | 'error') => void>();
let state: 'loading' | 'ready' | 'error' = 'loading';

function setState(s: typeof state) {
  state = s;
  listeners.forEach((l) => l(s));
}

export function onDemoStateChange(cb: (s: typeof state) => void) {
  listeners.add(cb);
  cb(state);
  return () => listeners.delete(cb);
}

export function ensureDemoReady(): Promise<void> {
  if (!ready) {
    ready = ensureSystemBootstrap()
      .then(() => setState('ready'))
      .catch((e) => {
        setState('error');
        ready = null;
        throw e;
      });
  }
  return ready;
}

export async function resetDemo(): Promise<void> {
  try {
    localStorage.removeItem('cs_session_token');
  } catch {
    // ignore
  }
  await destroyDemoDatabase();
  window.location.reload();
}

export async function localFetch(
  url: string,
  init: { method?: string; body?: BodyInit | null; headers?: Record<string, string> } = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  await ensureDemoReady();
  const u = new URL(url, window.location.origin);
  const method = (init.method || 'GET').toUpperCase();
  const query: Record<string, string> = {};
  u.searchParams.forEach((v, k) => (query[k] = v));
  let body: unknown = undefined;
  if (typeof init.body === 'string' && init.body) {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = undefined;
    }
  }
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(init.headers || {})) headers[k.toLowerCase()] = v;

  let router: any = null;
  let subPath = u.pathname;
  if (u.pathname.startsWith('/api/public')) {
    router = publicRoutes;
    subPath = u.pathname.slice('/api/public'.length) || '/';
  } else if (u.pathname.startsWith('/api/admin')) {
    router = adminRoutes;
    subPath = u.pathname.slice('/api/admin'.length) || '/';
  } else if (u.pathname === '/api/health') {
    return { ok: true, status: 200, data: { ok: true, database: 'navegador' } };
  }

  const res = new ShimResponse();
  const req: ShimRequest = {
    method,
    path: subPath,
    url: subPath + u.search,
    query,
    params: {},
    body,
    headers,
    ip: '127.0.0.1',
  };

  if (ownership.lost) {
    // Otra pestaña tiene la base: recargar para trabajar con los datos al día
    window.location.reload();
    return new Promise(() => {});
  }
  const handled = router ? await router.handle(req, res) : false;
  if (!handled) return { ok: false, status: 404, data: { error: 'Endpoint no encontrado.' } };
  return { ok: res.statusCode < 400, status: res.statusCode, data: res.body };
}
