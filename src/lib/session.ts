import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Autenticación local de demostración (sustituye a Firebase Auth).
 * - Contraseñas con scrypt + sal aleatoria.
 * - Sesiones con token firmado HMAC-SHA256 (sin estado en servidor), caducidad 7 días.
 */

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function loadSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Se genera una vez y se guarda junto a la base de datos local para que las sesiones
  // sobrevivan a reinicios del servidor.
  const dir = path.resolve(process.cwd(), '.data');
  const file = path.join(dir, 'session-secret');
  try {
    return fs.readFileSync(file, 'utf-8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

const SECRET = loadSecret();

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [algo, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createSessionToken(uid: string): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + TOKEN_TTL_MS })).toString(
    'base64url'
  );
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): { uid: string } | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (typeof data.uid !== 'string' || typeof data.exp !== 'number' || data.exp < Date.now()) {
      return null;
    }
    return { uid: data.uid };
  } catch {
    return null;
  }
}
