// Webhook de WhatsApp Cloud API: puerta de entrada por chat.
// El QR de la mesa puede abrir wa.me/<número>?text=Club%20MESA-7; al recibir ese mensaje respondemos
// con el enlace a la tarjeta (si ya es cliente) o al registro con el número prellenado.
import { Router } from 'express';
import express from 'express';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { normalizePhone } from '../lib/util.js';
import { sendText, validSignature } from '../lib/whatsapp.js';
import { cardUrl } from '../lib/customers.js';

const r = Router();

r.get('/whatsapp/webhook', (req, res) => {
  const ok = req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.whatsapp.verifyToken && config.whatsapp.verifyToken;
  if (ok) return res.status(200).send(req.query['hub.challenge']);
  res.sendStatus(403);
});

r.post('/whatsapp/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!validSignature(raw, req.get('x-hub-signature-256'))) return res.sendStatus(401);
  res.sendStatus(200); // Meta exige respuesta rápida; procesamos después.

  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); } catch { return; }
  const messages = payload?.entry?.flatMap((e) => e.changes || []).flatMap((c) => c.value?.messages || []) || [];
  for (const m of messages) {
    try { await handleInbound(m); } catch (e) { console.error('[whatsapp] error procesando mensaje', e); }
  }
});

export async function handleInbound(m) {
  const slug = config.whatsapp.defaultRestaurantSlug;
  if (!slug) return console.warn('[whatsapp] WA_DEFAULT_RESTAURANT_SLUG no está configurado');
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return;
  const phone = normalizePhone(m.from);
  if (!phone) return;
  const text = m.type === 'text' ? m.text?.body || '' : '';

  const tagCode = (text.match(/\b([A-Z]{2,10}-\d{1,4})\b/i) || [])[1]?.toUpperCase();
  const tag = tagCode ? await prisma.tag.findUnique({ where: { restaurantId_code: { restaurantId: restaurant.id, code: tagCode } } }) : null;
  const customer = await prisma.customer.findUnique({ where: { restaurantId_phone: { restaurantId: restaurant.id, phone } } });

  if (/\b(baja|stop|no más mensajes|no mas mensajes)\b/i.test(text) && customer) {
    await prisma.customer.update({ where: { id: customer.id }, data: { optOut: true } });
    return sendText({ restaurantId: restaurant.id, customerId: customer.id, to: phone, text: `Listo, no te enviaremos más promociones de ${restaurant.name}. Tu tarjeta y tus puntos siguen activos.` });
  }

  await prisma.entryEvent.create({ data: { restaurantId: restaurant.id, door: 'WHATSAPP', tagId: tag?.id, customerId: customer?.id } });

  if (customer) {
    return sendText({
      restaurantId: restaurant.id, customerId: customer.id, to: phone,
      text: `¡Hola${customer.name ? ' ' + customer.name.split(' ')[0] : ''}! Esta es tu tarjeta del Club de ${restaurant.name}: ${cardUrl(customer)}\nCuando pagues, escanea el QR de tu factura desde ahí y te sumamos los puntos.`
    });
  }
  const local = phone.replace('+57', '');
  const join = `${config.publicUrl}/r/${restaurant.slug}?via=wa&tel=${local}${tag ? `&t=${tag.code}` : ''}`;
  return sendText({
    restaurantId: restaurant.id, to: phone,
    text: `¡Hola! Bienvenido al Club de ${restaurant.name}. Crea tu tarjeta aquí, toma menos de un minuto: ${join}`
  });
}

export default r;
