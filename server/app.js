import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { config } from './config.js';
import { prisma } from './db.js';
import { HttpError } from './lib/util.js';
import whatsappRoutes from './routes/whatsapp.js';
import publicRoutes from './routes/public.js';
import staffRoutes from './routes/staff.js';
import panelRoutes from './routes/panel.js';
import cronRoutes from './routes/cron.js';
import accountRoutes from './routes/account.js';

const app = express();
app.set('trust proxy', 1); // Vercel (y Render) están detrás de un proxy

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'media-src': ["'self'", 'blob:'],
        'connect-src': ["'self'"]
      }
    }
  })
);

app.get('/healthz', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

// El webhook necesita el cuerpo sin procesar para validar la firma de Meta: va antes de express.json().
app.use('/api', whatsappRoutes);

app.use(express.json({ limit: '100kb' }));

const publicLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api/r', publicLimiter);
app.use('/api/c', publicLimiter);
app.use('/api/auth', loginLimiter);

app.use('/api', accountRoutes);
app.use('/api', publicRoutes);
app.use('/api', staffRoutes);
app.use('/api', panelRoutes);
// Cron de automatizaciones: en Vercel lo dispara "crons" en vercel.json; en Render lo llamaba un Cron Job aparte.
app.use('/api', cronRoutes);

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not_found', 'Ruta no encontrada.')));

// Frontend compilado (web/dist). En Vercel, Vercel sirve web/dist directamente como sitio estático
// (ver vercel.json), así que la función serverless solo necesita responder /api/*. En Render (o
// para probar el build de producción en local con `npm start`) seguimos sirviéndolo desde aquí.
if (!process.env.VERCEL) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, '../web/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: 'invalid_input', message: first?.message || 'Revisa los datos enviados.', field: first?.path?.join('.') });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
  if (err?.code === 'P2002') return res.status(409).json({ error: 'duplicate', message: 'Este registro ya existe o ya se usó.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json', message: 'La solicitud no es válida.' });
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: 'server_error', message: 'Algo falló de nuestro lado. Intenta de nuevo en un momento.' });
});

export default app;
export { config };
