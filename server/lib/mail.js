// Envío de correos transaccionales (restablecer contraseña) con la API de Resend.
// Sin RESEND_API_KEY el enlace se escribe en el log del servidor (en Vercel: Runtime Logs), para poder probar.
import { config } from '../config.js';

export async function sendMail({ to, subject, text, html }) {
  if (!config.mail.apiKey) {
    console.log(`[mail:dev] Para: ${to} · ${subject}\n${text}`);
    return { sent: false };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.mail.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.mail.from, to: [to], subject, text, html })
  });
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text().catch(() => '')}`);
  return { sent: true };
}
