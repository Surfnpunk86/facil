// Envío por WhatsApp Cloud API. Sin credenciales (desarrollo), registra el mensaje como SKIPPED_DEV
// y lo imprime en consola para poder probar los flujos completos.
import crypto from 'node:crypto';
import { config, whatsappEnabled } from '../config.js';
import { prisma } from '../db.js';

const graph = () => `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`;

async function post(body) {
  const res = await fetch(graph(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.whatsapp.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `WhatsApp HTTP ${res.status}`);
  return json?.messages?.[0]?.id || null;
}

async function log(data) {
  try { await prisma.messageLog.create({ data }); } catch (e) { console.error('[whatsapp] no se pudo registrar', e.message); }
}

/**
 * Envía una plantilla aprobada. `params` son los valores {{1}}, {{2}}… del cuerpo, en orden.
 * `kind` identifica la plantilla en config.whatsapp.templates y queda en MessageLog.
 */
export async function sendTemplate({ restaurantId, customerId = null, to, kind, params = [] }) {
  const name = config.whatsapp.templates[kind];
  if (!whatsappEnabled()) {
    console.log(`[whatsapp:dev] ${kind} → ${to}: ${params.join(' | ')}`);
    await log({ restaurantId, customerId, kind, status: 'SKIPPED_DEV' });
    return { ok: true, dev: true };
  }
  try {
    const providerId = await post({
      to: to.replace('+', ''),
      type: 'template',
      template: {
        name,
        language: { code: config.whatsapp.lang },
        components: params.length
          ? [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: String(p) })) }]
          : []
      }
    });
    await log({ restaurantId, customerId, kind, status: 'SENT', providerId });
    return { ok: true, providerId };
  } catch (e) {
    await log({ restaurantId, customerId, kind, status: 'FAILED', error: e.message.slice(0, 500) });
    return { ok: false, error: e.message };
  }
}

// Respuesta de texto libre: solo válida dentro de la ventana de 24 h abierta por el cliente.
export async function sendText({ restaurantId, customerId = null, to, text }) {
  if (!whatsappEnabled()) {
    console.log(`[whatsapp:dev] REPLY → ${to}: ${text}`);
    await log({ restaurantId, customerId, kind: 'REPLY', status: 'SKIPPED_DEV' });
    return { ok: true, dev: true };
  }
  try {
    const providerId = await post({ to: to.replace('+', ''), type: 'text', text: { body: text, preview_url: true } });
    await log({ restaurantId, customerId, kind: 'REPLY', status: 'SENT', providerId });
    return { ok: true };
  } catch (e) {
    await log({ restaurantId, customerId, kind: 'REPLY', status: 'FAILED', error: e.message.slice(0, 500) });
    return { ok: false, error: e.message };
  }
}

// Verifica la firma X-Hub-Signature-256 del webhook de Meta.
export function validSignature(rawBody, header) {
  if (!config.whatsapp.appSecret) return !config.isProd; // en producción el secreto es obligatorio
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', config.whatsapp.appSecret).update(rawBody).digest('hex');
  const got = header.slice(7);
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
