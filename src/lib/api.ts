/**
 * Cliente de la API.
 * - Modo DEMO (por defecto): la API se ejecuta dentro del navegador y los datos se guardan
 *   en este dispositivo. Funciona en cualquier hosting estático, sin servidor.
 * - Modo SERVIDOR (`VITE_API_MODE=server`): llama al backend Express real (/api/*).
 */
export const API_MODE: 'demo' | 'server' =
  import.meta.env.VITE_API_MODE === 'server' ? 'server' : 'demo';

export async function apiFetch<T>(
  url: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) {
    finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  if (API_MODE === 'demo') {
    const { localFetch } = await import('../demo/local-api');
    const res = await localFetch(url, { method: rest.method, body: rest.body, headers: finalHeaders });
    const data = (res.data ?? {}) as any;
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data as T;
  }

  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data as T;
}
