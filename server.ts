import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import publicRoutes from './src/routes/public.ts';
import adminRoutes from './src/routes/admin.ts';

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

app.use('/api/public/bookings', rateLimit(20, 60_000));
app.use('/api/public/lookup-customer', rateLimit(25, 60_000));
app.use('/api/public/waitlist', rateLimit(15, 60_000));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'club-segorbe-os', timezone: 'Europe/Madrid' });
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
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Club Segorbe OS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
