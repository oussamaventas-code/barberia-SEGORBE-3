import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import publicRoutes from './src/routes/public.ts';
import adminRoutes from './src/routes/admin.ts';
import { ensureSystemBootstrap, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_STAFF_EMAIL, DEMO_STAFF_PASSWORD } from './src/services/bootstrap.ts';
import { dbLocation } from './src/db/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '1mb' }));

// Lightweight sliding-window rate limiter against public endpoint abuse
const rateMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const record = rateMap.get(key);
    if (!record || record.resetAt < now) {
      rateMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Demasiadas solicitudes en poco tiempo. Espera unos segundos e inténtalo de nuevo.',
      });
    }
    record.count += 1;
    next();
  };
}

// Periodic cleanup so the in-memory rate map never grows unbounded
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of rateMap) if (rec.resetAt < now) rateMap.delete(key);
}, 60_000).unref();

app.use('/api/public/bookings', rateLimit(20, 60_000));
app.use('/api/public/lookup-customer', rateLimit(25, 60_000));
app.use('/api/public/waitlist', rateLimit(15, 60_000));
app.use('/api/admin/auth/login', rateLimit(10, 60_000));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'barberia-segorbe-os', timezone: 'Europe/Madrid', database: 'pglite-local' });
});

// API Routes
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

// API 404 handler
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// Global error handler (sanitized)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

async function startServer() {
  await ensureSystemBootstrap();
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  Segorbe OS → http://localhost:${PORT}`);
    console.log(`  Base de datos local: ${dbLocation}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`  Panel /admin  → ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD} (admin)`);
      console.log(`                → ${DEMO_STAFF_EMAIL} / ${DEMO_STAFF_PASSWORD} (barbero)\n`);
    }
  });
}

startServer().catch((error) => {
  console.error('No se pudo arrancar el servidor:', error);
  process.exit(1);
});
