/** Sustituto mínimo de `node:crypto` para el navegador (solo lo que usan los servicios). */
function randomBytes(n: number) {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return {
    toString(_encoding: 'hex' = 'hex') {
      return Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
    },
  };
}

function randomInt(min: number, max: number): number {
  const range = max - min;
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return min + (buf[0] % range);
}

function randomUUID(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const h = randomBytes(16).toString();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const cryptoShim = { randomBytes, randomInt, randomUUID };
export { randomBytes, randomInt, randomUUID };
export default cryptoShim;
