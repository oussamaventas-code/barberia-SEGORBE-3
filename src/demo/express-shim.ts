/**
 * Implementación mínima de `express.Router` para ejecutar las rutas de la API
 * dentro del navegador (modo demo sin servidor). Solo cubre lo que usan
 * src/routes/public.ts y src/routes/admin.ts.
 */
type Handler = (req: any, res: any, next: (err?: unknown) => void) => unknown;

interface Layer {
  method: string | null; // null = use()
  keys: string[];
  regex: RegExp | null; // null = matches any path (use without path)
  handlers: Handler[];
}

function compile(path: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const pattern = path
    .replace(/\/+$/, '')
    .replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === ':' ? m : `\\${m}`))
    .replace(/:(\w+)/g, (_m, k) => {
      keys.push(k);
      return '([^/]+)';
    });
  return { regex: new RegExp(`^${pattern || ''}/?$`), keys };
}

export class ShimResponse {
  statusCode = 200;
  body: unknown = undefined;
  finished = false;
  private listeners: Array<() => void> = [];
  private resolveDone!: () => void;
  done = new Promise<void>((r) => (this.resolveDone = r));

  status(code: number) {
    this.statusCode = code;
    return this;
  }
  setHeader() {
    return this;
  }
  on(event: string, cb: () => void) {
    if (event === 'finish') this.listeners.push(cb);
    return this;
  }
  json(body: unknown) {
    if (this.finished) return this;
    this.body = body;
    this.finished = true;
    this.resolveDone();
    queueMicrotask(() => this.listeners.forEach((l) => l()));
    return this;
  }
  send(body: unknown) {
    return this.json(body);
  }
}

export interface ShimRequest {
  method: string;
  path: string;
  url: string;
  query: Record<string, string>;
  params: Record<string, string>;
  body: any;
  headers: Record<string, string | undefined>;
  ip: string;
  [key: string]: unknown;
}

export function Router() {
  const stack: Layer[] = [];

  const add = (method: string | null, args: unknown[]) => {
    let path: string | null = null;
    if (typeof args[0] === 'string') path = args.shift() as string;
    const compiled = path ? compile(path) : null;
    stack.push({
      method,
      keys: compiled?.keys ?? [],
      regex: compiled?.regex ?? null,
      handlers: args as Handler[],
    });
  };

  const router: any = {
    get: (...a: unknown[]) => (add('GET', a), router),
    post: (...a: unknown[]) => (add('POST', a), router),
    put: (...a: unknown[]) => (add('PUT', a), router),
    patch: (...a: unknown[]) => (add('PATCH', a), router),
    delete: (...a: unknown[]) => (add('DELETE', a), router),
    use: (...a: unknown[]) => (add(null, a), router),

    /** Ejecuta la petición; resuelve `true` si alguna ruta respondió. */
    async handle(req: ShimRequest, res: ShimResponse): Promise<boolean> {
      const queue: Array<{ handler: Handler; params: Record<string, string> }> = [];
      for (const layer of stack) {
        if (layer.method && layer.method !== req.method) continue;
        let params: Record<string, string> = {};
        if (layer.regex) {
          const m = layer.regex.exec(req.path);
          if (!m) continue;
          layer.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        } else if (layer.method) {
          continue;
        }
        for (const handler of layer.handlers) queue.push({ handler, params });
      }

      let index = 0;
      const run = async (err?: unknown): Promise<void> => {
        if (err) throw err;
        if (res.finished) return;
        const item = queue[index++];
        if (!item) return;
        req.params = item.params;
        let nextCalled = false;
        let nextPromise: Promise<void> | null = null;
        await item.handler(req, res, (e?: unknown) => {
          nextCalled = true;
          nextPromise = run(e);
        });
        if (nextCalled && nextPromise) await nextPromise;
      };

      try {
        await run();
      } catch (error) {
        console.error('[demo api] Error:', error);
        if (!res.finished) res.status(500).json({ error: 'Error interno.' });
      }
      return res.finished;
    },
  };
  return router;
}

const express = { Router };
export default express;
export type Request = ShimRequest;
export type Response = ShimResponse;
export type NextFunction = (err?: unknown) => void;
