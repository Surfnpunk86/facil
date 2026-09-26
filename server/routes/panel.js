// Panel del administrador: indicadores, clientes en riesgo, automatizaciones, opiniones y configuración.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireStaff, requireOwner } from '../auth.js';
import { HttpError, firstName, maskPhone, daysBetween, normalizePhone } from '../lib/util.js';
import { riskOf } from '../lib/insights.js';
import { sendTemplate } from '../lib/whatsapp.js';
import { cardUrl, publicRestaurant } from '../lib/customers.js';
import { config } from '../config.js';

const r = Router();
r.use('/panel', requireStaff, requireOwner);

const AUTOMATIONS = [
  { key: 'WELCOME', title: 'Bienvenida', detail: 'Al inscribirse: enlace a su tarjeta del Club' },
  { key: 'WINBACK', title: 'Te extrañamos', detail: 'Cuando un cliente lleva más del doble de su frecuencia sin volver' },
  { key: 'BIRTHDAY', title: 'Cumpleaños', detail: '5 días antes, con un premio que vence a los 10 días' },
  { key: 'NEAR_REWARD', title: 'Premio casi listo', detail: 'Cuando le falta un sello para completar la tarjeta' },
  { key: 'LOW_RATING', title: 'Alerta de calificación baja', detail: 'Aviso al administrador con 1 a 3 estrellas' }
];

const since = (days) => new Date(Date.now() - days * 86400000);

r.get('/panel/summary', async (req, res) => {
  const rid = req.staff.restaurantId;
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const from = since(days);
  const [restaurant, enrolled, newMembers, agg, active, redeemed, atRiskCandidates] = await Promise.all([
    prisma.restaurant.findUniqueOrThrow({ where: { id: rid } }),
    prisma.customer.count({ where: { restaurantId: rid } }),
    prisma.customer.count({ where: { restaurantId: rid, createdAt: { gte: from } } }),
    prisma.purchase.aggregate({ where: { restaurantId: rid, createdAt: { gte: from } }, _sum: { amount: true }, _count: true }),
    prisma.purchase.groupBy({ by: ['customerId'], where: { restaurantId: rid, createdAt: { gte: from } } }),
    prisma.reward.count({ where: { restaurantId: rid, redeemedAt: { gte: from } } }),
    prisma.customer.findMany({ where: { restaurantId: rid, lastVisitAt: { lt: since(14) } }, take: 2000 })
  ]);
  const purchases = agg._count;
  const sales = agg._sum.amount || 0;
  const atRisk = atRiskCandidates.map((c) => riskOf(c)).filter(Boolean);
  res.json({
    days,
    restaurant: publicRestaurant(restaurant),
    enrolled,
    newMembers,
    validatedSales: sales,
    purchases,
    activeMembers: active.length,
    visitsPerActive: active.length ? +(purchases / active.length).toFixed(1) : 0,
    avgTicket: purchases ? Math.round(sales / purchases) : 0,
    rewardsRedeemed: redeemed,
    atRisk: atRisk.length,
    atRiskHigh: atRisk.filter((x) => x.level === 'ALTO').length
  });
});

r.get('/panel/doors', async (req, res) => {
  const rid = req.staff.restaurantId;
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const from = since(days);
  const [purchases, entries] = await Promise.all([
    prisma.purchase.groupBy({ by: ['door'], where: { restaurantId: rid, createdAt: { gte: from } }, _count: true, _sum: { amount: true } }),
    prisma.entryEvent.groupBy({ by: ['door'], where: { restaurantId: rid, createdAt: { gte: from } }, _count: true })
  ]);
  const doors = ['NFC', 'QR', 'WHATSAPP', 'WALLET', 'CASHIER', 'DELIVERY_CODE'].map((door) => ({
    door,
    purchases: purchases.find((p) => p.door === door)?._count || 0,
    sales: purchases.find((p) => p.door === door)?._sum.amount || 0,
    entries: entries.find((e) => e.door === door)?._count || 0
  }));
  res.json({ days, doors });
});

r.get('/panel/at-risk', async (req, res) => {
  const rid = req.staff.restaurantId;
  const candidates = await prisma.customer.findMany({ where: { restaurantId: rid, lastVisitAt: { lt: since(14) } }, take: 2000 });
  const list = candidates
    .map((c) => ({ c, risk: riskOf(c) }))
    .filter((x) => x.risk)
    .sort((a, b) => b.c.totalSpent - a.c.totalSpent)
    .slice(0, 50);
  const lastInvites = await prisma.messageLog.groupBy({
    by: ['customerId'],
    where: { customerId: { in: list.map((x) => x.c.id) }, kind: 'WINBACK', status: { in: ['SENT', 'SKIPPED_DEV'] } },
    _max: { createdAt: true }
  });
  res.json({
    customers: list.map(({ c, risk }) => ({
      id: c.id,
      name: c.name || 'Sin nombre',
      phone: maskPhone(c.phone),
      visits: c.visits,
      avgTicket: risk.avgTicket,
      daysSince: risk.daysSince,
      level: risk.level,
      canMessage: Boolean(c.consentAt) && !c.optOut,
      lastInvitedAt: lastInvites.find((l) => l.customerId === c.id)?._max.createdAt || null
    }))
  });
});

// Plantilla facil_te_extranamos: {{1}} nombre, {{2}} restaurante, {{3}} enlace de la tarjeta.
r.post('/panel/customers/:id/invite', async (req, res) => {
  const c = await prisma.customer.findUnique({ where: { id: req.params.id }, include: { restaurant: true } });
  if (!c || c.restaurantId !== req.staff.restaurantId) throw new HttpError(404, 'customer_not_found', 'Cliente no encontrado.');
  if (!c.consentAt || c.optOut) throw new HttpError(422, 'no_consent', 'Este cliente no ha autorizado mensajes promocionales.');
  const recent = await prisma.messageLog.findFirst({ where: { customerId: c.id, kind: 'WINBACK', createdAt: { gte: since(7) } } });
  if (recent) throw new HttpError(409, 'recently_invited', 'Ya se le envió una invitación en los últimos 7 días.');
  const result = await sendTemplate({
    restaurantId: c.restaurantId, customerId: c.id, to: c.phone, kind: 'WINBACK',
    params: [firstName(c.name), c.restaurant.name, cardUrl(c)]
  });
  if (!result.ok) throw new HttpError(502, 'whatsapp_failed', `WhatsApp rechazó el mensaje: ${result.error}`);
  res.json({ ok: true });
});

r.get('/panel/automations', async (req, res) => {
  const rows = await prisma.automation.findMany({ where: { restaurantId: req.staff.restaurantId } });
  res.json({
    automations: AUTOMATIONS.map((a) => ({ ...a, enabled: rows.find((x) => x.key === a.key)?.enabled ?? true }))
  });
});

r.put('/panel/automations/:key', async (req, res) => {
  const key = z.enum(['WELCOME', 'WINBACK', 'BIRTHDAY', 'NEAR_REWARD', 'LOW_RATING']).parse(req.params.key);
  const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body || {});
  await prisma.automation.upsert({
    where: { restaurantId_key: { restaurantId: req.staff.restaurantId, key } },
    create: { restaurantId: req.staff.restaurantId, key, enabled },
    update: { enabled }
  });
  res.json({ ok: true, key, enabled });
});

r.get('/panel/feedback', async (req, res) => {
  const rows = await prisma.feedback.findMany({
    where: { restaurantId: req.staff.restaurantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { customer: true }
  });
  const avg = await prisma.feedback.aggregate({ where: { restaurantId: req.staff.restaurantId, createdAt: { gte: since(30) } }, _avg: { rating: true }, _count: true });
  res.json({
    average30d: avg._avg.rating ? +avg._avg.rating.toFixed(1) : null,
    count30d: avg._count,
    items: rows.map((f) => ({
      id: f.id, rating: f.rating, comment: f.comment, createdAt: f.createdAt, handledAt: f.handledAt,
      customer: f.customer ? { name: f.customer.name, phone: maskPhone(f.customer.phone) } : null,
      daysAgo: daysBetween(f.createdAt, new Date())
    }))
  });
});

r.post('/panel/feedback/:id/handled', async (req, res) => {
  const f = await prisma.feedback.findUnique({ where: { id: req.params.id } });
  if (!f || f.restaurantId !== req.staff.restaurantId) throw new HttpError(404, 'not_found', 'Opinión no encontrada.');
  await prisma.feedback.update({ where: { id: f.id }, data: { handledAt: new Date() } });
  res.json({ ok: true });
});

const settingsSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  pointsPerThousand: z.number().int().min(0).max(100).optional(),
  stampsGoal: z.number().int().min(2).max(20).optional(),
  rewardText: z.string().min(2).max(120).optional(),
  birthdayRewardText: z.string().min(2).max(120).optional(),
  googleReviewUrl: z.string().url().nullable().optional(),
  ownerAlertPhone: z.string().max(20).nullable().optional(),
  maxClaimsPerDay: z.number().int().min(1).max(10).optional(),
  invoiceMaxAgeHours: z.number().int().min(1).max(720).optional()
});

r.get('/panel/settings', async (req, res) => {
  const rest = await prisma.restaurant.findUniqueOrThrow({ where: { id: req.staff.restaurantId } });
  res.json({ settings: rest });
});

r.put('/panel/settings', async (req, res) => {
  const data = settingsSchema.parse(req.body || {});
  if (data.ownerAlertPhone) {
    data.ownerAlertPhone = normalizePhone(data.ownerAlertPhone);
    if (!data.ownerAlertPhone) throw new HttpError(400, 'invalid_phone', 'El WhatsApp de alertas debe ser un celular colombiano de 10 dígitos.');
  }
  const rest = await prisma.restaurant.update({ where: { id: req.staff.restaurantId }, data });
  res.json({ settings: rest });
});

// Piezas de mesa y caja. Cada una trae las URL que se graban en el chip NFC y en el QR impreso.
r.get('/panel/tags', async (req, res) => {
  const rest = await prisma.restaurant.findUniqueOrThrow({ where: { id: req.staff.restaurantId }, include: { tags: { orderBy: { code: 'asc' } } } });
  res.json({
    tags: rest.tags.map((t) => ({
      id: t.id, code: t.code, label: t.label, active: t.active,
      nfcUrl: `${config.publicUrl}/r/${rest.slug}?t=${t.code}&via=nfc`,
      qrUrl: `${config.publicUrl}/r/${rest.slug}?t=${t.code}&via=qr`
    }))
  });
});

r.post('/panel/tags', async (req, res) => {
  const { code, label } = z.object({ code: z.string().regex(/^[A-Za-z0-9-]{2,20}$/), label: z.string().max(60).optional() }).parse(req.body || {});
  try {
    const t = await prisma.tag.create({ data: { restaurantId: req.staff.restaurantId, code: code.toUpperCase(), label } });
    res.json({ tag: t });
  } catch (e) {
    if (e.code === 'P2002') throw new HttpError(409, 'tag_exists', 'Ya existe una pieza con ese código.');
    throw e;
  }
});

r.post('/panel/staff', async (req, res) => {
  const body = z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(8), role: z.enum(['OWNER', 'CASHIER']).default('CASHIER') }).parse(req.body || {});
  try {
    const s = await prisma.staff.create({
      data: { restaurantId: req.staff.restaurantId, name: body.name, email: body.email.toLowerCase(), passwordHash: await bcrypt.hash(body.password, 10), role: body.role }
    });
    res.json({ staff: { id: s.id, name: s.name, email: s.email, role: s.role } });
  } catch (e) {
    if (e.code === 'P2002') throw new HttpError(409, 'email_exists', 'Ya existe un usuario con ese correo.');
    throw e;
  }
});

export default r;
