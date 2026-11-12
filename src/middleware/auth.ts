import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { profiles } from '../db/schema.ts';
import { verifySessionToken } from '../lib/session.ts';

export interface AppProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  staffId: number | null;
}

export interface AuthRequest extends Request {
  profile?: AppProfile;
}

export function toAppProfile(p: typeof profiles.$inferSelect): AppProfile {
  return {
    id: p.id,
    uid: p.uid,
    email: p.email,
    fullName: p.fullName,
    role: p.role as AppProfile['role'],
    staffId: p.staffId,
  };
}

async function resolveProfile(req: Request): Promise<AppProfile | null> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const session = verifySessionToken(header.slice('Bearer '.length).trim());
  if (!session) return null;
  const [p] = await db.select().from(profiles).where(eq(profiles.uid, session.uid)).limit(1);
  return p ? toAppProfile(p) : null;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(401).json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' });
    }
    req.profile = profile;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    req.profile = (await resolveProfile(req)) ?? undefined;
  } catch {
    // Ignore invalid optional token
  }
  next();
};

export const requireAdminOrStaff = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.profile || (req.profile.role !== 'ADMIN' && req.profile.role !== 'STAFF')) {
    return res.status(403).json({ error: 'Acceso denegado: permisos de administración requeridos.' });
  }
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.profile || req.profile.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol ADMIN.' });
  }
  next();
};
