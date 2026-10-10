// Endpoint que dispara las automatizaciones diarias (cumpleaños, "te extrañamos", premio casi
// listo, vencimiento de premios). En Render esto era un Cron Job aparte que corría
// `node server/jobs/automations.js`; en Vercel no hay procesos de fondo, así que "vercel.json"
// programa una llamada HTTP a esta ruta con "crons".
import { Router } from 'express';
import { runAutomations } from '../jobs/automations.js';

const r = Router();

async function handleCron(req, res, next) {
  try {
    // Vercel firma sus llamadas de cron con este encabezado cuando se define CRON_SECRET
    // (Project Settings → Environment Variables). Si no está configurado, no se exige (útil en
    // local), pero en producción conviene definirlo para que nadie más pueda disparar el cron.
    const secret = process.env.CRON_SECRET;
    if (secret && req.get('authorization') !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const summary = await runAutomations();
    res.json({ ok: true, summary });
  } catch (err) {
    next(err);
  }
}

// Vercel invoca las rutas definidas en "crons" con GET; se acepta también POST para probarla a mano.
r.get('/cron/automations', handleCron);
r.post('/cron/automations', handleCron);

export default r;
