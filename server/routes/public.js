// Rutas públicas: entrada por las puertas, registro y acciones del cliente sobre su tarjeta.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError, normalizePhone } from '../lib/util.js';
import { parseInvoiceQr, nitMatches, invoiceDate } from '../lib/dian.js';
import { awardPurchase } from '../lib/rewards.js';
import { sendTemplate } from '../lib/whatsapp.js';
import { config } from '../config.js';
import {
  getRestaurantBySlug, upsertCustomer, sendWelcome, sendCardLink, sendPurchaseReceipt,
  cardView, publicRestaurant, automationEnabled
} from '../lib/customers.js';

const r = Router();
const CUSTOMER_DOORS = ['NFC', 'QR', 'WHATSAPP', 'WALLET'];

async function findTag(restaurantId, code) {
  if (!code) return null;
  return prisma.tag.findUnique({ where: { restaurantId_code: { restaurantId, code: String(code).toUpperCase() } } });
}

async function customerByToken(token) {
  const c = await prisma.customer.findUnique({ where: { cardToken: String(token) }, include: { restaurant: true } });
  if (!c) throw new HttpError(404, 'card_not_found', 'No encontramos esta tarjeta. Pide un enlace nuevo en el restaurante.');
  return c;
}

// ---------- Restaurante y puertas ----------

r.get('/r/:slug', async (req, res) => {
  const rest = await getRestaurantBySlug(req.params.slug);
  const tag = await findTag(rest.id, req.query.t);
  res.json({ restaurant: publicRestaurant(rest), tag: tag && tag.active ? { code: tag.code, label: tag.label } : null });
});

const entrySchema = z.object({
  door: z.enum(['NFC', 'QR', 'WHATSAPP', 'WALLET']).default('QR'),
  tag: z.string().max(40).optional(),
  cardToken: z.string().max(60).optional()
});

r.post('/r/:slug/entry', async (req, res) => {
  const rest = await getRestaurantBySlug(req.params.slug);
  const body = entrySchema.parse(req.body || {});
  const tag = await findTag(rest.id, body.tag);
  let customerId = null;
  if (body.cardToken) {
    const c = await prisma.customer.findUnique({ where: { cardToken: body.cardToken } });
    if (c && c.restaurantId === rest.id) customerId = c.id;
  }
  await prisma.entryEvent.create({ data: { restaurantId: rest.id, door: body.door, tagId: tag?.id, customerId } });
  res.json({ ok: true, known: Boolean(customerId) });
});

const joinSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre.').max(80),
  phone: z.string().min(7).max(20),
  birthday: z.string().regex(/^\d{2}-\d{2}$/).optional().or(z.literal('')),
  consent: z.literal(true, { errorMap: () => ({ message: 'Necesitamos tu autorización de datos para crear la tarjeta.' }) }),
  door: z.enum(['NFC', 'QR', 'WHATSAPP', 'WALLET']).default('QR'),
  tag: z.string().max(40).optional()
});

r.post('/r/:slug/join', async (req, res) => {
  const rest = await getRestaurantBySlug(req.params.slug);
  const body = joinSchema.parse(req.body || {});
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError(400, 'invalid_phone', 'Escribe un celular colombiano de 10 dígitos, por ejemplo 300 555 1234.');
  let birthMonth = null, birthDay = null;
  if (body.birthday) {
    const [m, d] = body.birthday.split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) { birthMonth = m; birthDay = d; }
  }

  const { customer, created } = await upsertCustomer({ restaurant: rest, phone, name: body.name, birthMonth, birthDay, consent: true, door: body.door });
  const tag = await findTag(rest.id, body.tag);
  await prisma.entryEvent.create({ data: { restaurantId: rest.id, door: body.door, tagId: tag?.id, customerId: customer.id } });

  if (created) {
    await sendWelcome(rest, customer);
    return res.json({ status: 'created', token: customer.cardToken });
  }
  // Número ya inscrito: la tarjeta se entrega solo por WhatsApp a ese número, para no exponer datos de otra persona.
  await sendCardLink(rest, customer);
  res.json({ status: 'link_sent', ...(config.isProd ? {} : { devToken: customer.cardToken }) });
});

// "Ya soy del Club": reenvía el enlace de la tarjeta al WhatsApp inscrito.
r.post('/r/:slug/card-link', async (req, res) => {
  const rest = await getRestaurantBySlug(req.params.slug);
  const phone = normalizePhone(req.body?.phone);
  if (!phone) throw new HttpError(400, 'invalid_phone', 'Escribe un celular colombiano de 10 dígitos, por ejemplo 300 555 1234.');
  const customer = await prisma.customer.findUnique({ where: { restaurantId_phone: { restaurantId: rest.id, phone } } });
  if (!customer) throw new HttpError(404, 'not_member', 'Ese número todavía no está en el Club. Únete con tus datos, toma menos de un minuto.');
  await sendCardLink(rest, customer);
  res.json({ status: 'link_sent', ...(config.isProd ? {} : { devToken: customer.cardToken }) });
});

// ---------- Tarjeta del cliente ----------

r.get('/c/:token', async (req, res) => {
  const c = await customerByToken(req.params.token);
  res.json(await cardView(c, c.restaurant));
});

r.post('/c/:token/consent', async (req, res) => {
  const c = await customerByToken(req.params.token);
  const updated = await prisma.customer.update({
    where: { id: c.id },
    data: { consentAt: c.consentAt ?? new Date(), consentVersion: config.consentVersion, optOut: false, name: c.name || (req.body?.name ? String(req.body.name).slice(0, 80) : null) }
  });
  res.json(await cardView(updated, c.restaurant));
});

r.post('/c/:token/optout', async (req, res) => {
  const c = await customerByToken(req.params.token);
  await prisma.customer.update({ where: { id: c.id }, data: { optOut: true } });
  res.json({ ok: true });
});

const invoiceSchema = z.object({ qr: z.string().min(10).max(2000), door: z.enum(['NFC', 'QR', 'WHATSAPP', 'WALLET']).default('QR') });

r.post('/c/:token/invoice', async (req, res) => {
  const c = await customerByToken(req.params.token);
  const rest = c.restaurant;
  const body = invoiceSchema.parse(req.body || {});
  const inv = parseInvoiceQr(body.qr);

  if (!inv.key) throw new HttpError(422, 'invoice_unreadable', 'No reconocimos este código como una factura electrónica. Escanea el QR de la factura o pide en caja que confirmen tu compra con tu número.');
  if (!inv.total) throw new HttpError(422, 'invoice_no_amount', 'Esta factura no trae el valor en su código. Pide en caja que confirmen tu compra con tu número.');
  if (inv.nit && !nitMatches(inv.nit, rest.nit)) throw new HttpError(422, 'invoice_other_business', `Esta factura no es de ${rest.name}.`);
  if (!inv.nit) throw new HttpError(422, 'invoice_no_nit', 'No pudimos confirmar que la factura sea de este local. Pide en caja que confirmen tu compra.');
  const when = invoiceDate(inv);
  if (when) {
    const ageH = (Date.now() - when.getTime()) / 3600000;
    if (ageH > rest.invoiceMaxAgeHours) throw new HttpError(422, 'invoice_expired', `La factura tiene más de ${rest.invoiceMaxAgeHours} horas. Solo se suman compras recientes.`);
    if (ageH < -24) throw new HttpError(422, 'invoice_date', 'La fecha de la factura no es válida.');
  }

  const result = await awardPurchase({
    restaurant: rest, customerId: c.id, amount: inv.total, door: CUSTOMER_DOORS.includes(body.door) ? body.door : 'QR',
    validation: 'INVOICE', invoiceKey: inv.key, invoiceNumber: inv.number
  });
  await sendPurchaseReceipt(rest, result.customer, result.pointsAwarded);
  res.json({
    ok: true,
    amount: inv.total,
    invoiceNumber: inv.number,
    pointsAwarded: result.pointsAwarded,
    rewardUnlocked: result.rewardUnlocked ? { description: result.rewardUnlocked.description } : null,
    card: await cardView(result.customer, rest)
  });
});

r.post('/c/:token/code', async (req, res) => {
  const c = await customerByToken(req.params.token);
  const code = String(req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const dc = await prisma.deliveryCode.findUnique({ where: { code } });
  if (!dc || dc.restaurantId !== c.restaurantId) throw new HttpError(404, 'code_not_found', 'Este código no existe. Revísalo en el sticker de tu pedido.');
  if (dc.usedAt) throw new HttpError(409, 'code_used', 'Este código ya se usó.');
  if (dc.expiresAt < new Date()) throw new HttpError(422, 'code_expired', 'Este código ya venció.');

  // Marca el código antes de premiar para que dos solicitudes simultáneas no lo usen dos veces.
  const claimed = await prisma.deliveryCode.updateMany({ where: { id: dc.id, usedAt: null }, data: { usedAt: new Date(), customerId: c.id } });
  if (!claimed.count) throw new HttpError(409, 'code_used', 'Este código ya se usó.');
  try {
    const result = await awardPurchase({ restaurant: c.restaurant, customerId: c.id, amount: dc.amount, door: 'DELIVERY_CODE', validation: 'DELIVERY_CODE' });
    await sendPurchaseReceipt(c.restaurant, result.customer, result.pointsAwarded);
    res.json({ ok: true, amount: dc.amount, pointsAwarded: result.pointsAwarded, rewardUnlocked: result.rewardUnlocked ? { description: result.rewardUnlocked.description } : null, card: await cardView(result.customer, c.restaurant) });
  } catch (e) {
    await prisma.deliveryCode.update({ where: { id: dc.id }, data: { usedAt: null, customerId: null } });
    throw e;
  }
});

const feedbackSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() });

// Todos reciben el enlace de reseña de Google; la calificación baja además alerta al administrador.
r.post('/c/:token/feedback', async (req, res) => {
  const c = await customerByToken(req.params.token);
  const body = feedbackSchema.parse(req.body || {});
  await prisma.feedback.create({ data: { restaurantId: c.restaurantId, customerId: c.id, rating: body.rating, comment: body.comment || null } });
  if (body.rating <= 3 && c.restaurant.ownerAlertPhone && (await automationEnabled(c.restaurantId, 'LOW_RATING'))) {
    // Plantilla facil_alerta_calificacion: {{1}} estrellas, {{2}} cliente, {{3}} comentario.
    await sendTemplate({
      restaurantId: c.restaurantId, to: c.restaurant.ownerAlertPhone, kind: 'LOW_RATING_ALERT',
      params: [body.rating, c.name || c.phone, (body.comment || 'Sin comentario').slice(0, 300)]
    });
  }
  res.json({ ok: true, googleReviewUrl: c.restaurant.googleReviewUrl });
});

export default r;
