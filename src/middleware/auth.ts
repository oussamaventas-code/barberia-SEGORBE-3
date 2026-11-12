import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { eq, sql } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { profiles } from '../db/schema.ts';

export interface AppProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  staffId: number | null;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  profile?: AppProfile;
}

function getConfiguredAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function syncUserProfile(decodedToken: DecodedIdToken): Promise<AppProfile> {
  try {
    const email = (decodedToken.email || '').toLowerCase();
    const fullName = decodedToken.name || null;

    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.uid, decodedToken.uid))
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const adminEmails = getConfiguredAdminEmails();
      const shouldElevate = adminEmails.includes(email) && current.role !== 'ADMIN';

      if (shouldElevate || current.email !== email || (fullName && current.fullName !== fullName)) {
        const updated = await db
          .update(profiles)
          .set({
            email: email || current.email,
            fullName: fullName ?? current.fullName,
            role: shouldElevate ? 'ADMIN' : current.role,
            updatedAt: new Date(),
          })
          .where(eq(profiles.id, current.id))
          .returning();
        const p = updated[0];
        return {
          id: p.id,
          uid: p.uid,
          email: p.email,
          fullName: p.fullName,
          role: p.role as AppProfile['role'],
          staffId: p.staffId,
        };
      }

      return {
        id: current.id,
        uid: current.uid,
        email: current.email,
        fullName: current.fullName,
        role: current.role as AppProfile['role'],
        staffId: current.staffId,
      };
    }

    // Determine initial role: ADMIN if listed in ADMIN_EMAILS OR if zero ADMINs exist yet in DB
    const adminEmails = getConfiguredAdminEmails();
    let assignedRole: AppProfile['role'] = 'CUSTOMER';
    if (adminEmails.includes(email)) {
      assignedRole = 'ADMIN';
    } else {
      const adminCountRes = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(profiles)
        .where(eq(profiles.role, 'ADMIN'));
      if ((adminCountRes[0]?.count ?? 0) === 0) {
        assignedRole = 'ADMIN';
      }
    }

    const inserted = await db
      .insert(profiles)
      .values({
        uid: decodedToken.uid,
        email: email || `${decodedToken.uid}@unknown.local`,
        fullName,
        role: assignedRole,
      })
      .onConflictDoUpdate({
        target: profiles.uid,
        set: {
          email: email || `${decodedToken.uid}@unknown.local`,
          fullName,
          updatedAt: new Date(),
        },
      })
      .returning();

    const p = inserted[0];
    return {
      id: p.id,
      uid: p.uid,
      email: p.email,
      fullName: p.fullName,
      role: p.role as AppProfile['role'],
      staffId: p.staffId,
    };
  } catch (error) {
    console.error('Failed to sync user profile:', error);
    throw new Error('Error sincronizando perfil de usuario.', { cause: error });
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado: token requerido.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    req.profile = await syncUserProfile(decodedToken);
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      req.profile = await syncUserProfile(decodedToken);
    } catch {
      // Ignore invalid optional token
    }
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
