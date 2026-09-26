// Rutas de caja: identificar al cliente, confirmar compras, canjear premios y generar códigos de domicilio.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { signStaff, requireStaff } from '../auth.js';
import { HttpError, normalizePhone, maskPhone, randomCode } from '../lib/util.js';
import { awardPurchase } from '../lib/rewards.js';
import { suggestionFor, riskOf, daysToBirthday } from '../lib/insights.js';
import { upsertCustomer, sendCardLink, sendPurchaseReceipt, publicRestaurant } from '../lib/customers.js';

const r = Router();

r.post('/auth/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body || {});
  const staff = await prisma.staff.findUnique({ where: { email: email.toLowerCase() }, include: { restaurant: true } });
  if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) {
    throw new HttpError(401, 'bad_credentials', 'Correo o contraseña incorrectos.');
  }
  res.json({ token: signStaff(staff), staff: { name: staff.name, role: staff.role }, restaurant: publicRestaurant(staff.restaurant) });
});

r.use('/staff', requireStaff);

async function loadRestaurant(req) {
  return prisma.restaurant.findUniqueOrThrow({ where: { id: req.staff.restaurantId } });
}

async function profile(customer, restaurant) {
  const rewards = await prisma.reward.findMany({ where: { customerId: customer.id, status: 'AVAILABLE' }, orderBy: { createdAt: 'asc' } });
  const risk = riskOf(customer);
  const bday = daysToBirthday(customer);
  return {
    id: customer.id,
    name: customer.name,
    phone: maskPhone(customer.phone),
    visits: customer.visits,
    points: customer.points,
    stamps: customer.stamps,
    stampsGoal: restaurant.stampsGoal,
    avgTicket: customer.visits ? Math.round(customer.totalSpent / customer.visits) : 0,
    lastVisitAt: customer.lastVisitAt,
    hasConsent: Boolean(customer.consentAt),
    tags: [
      risk ? `${risk.daysSince} días sin venir` : null,
      bday !== null && bday <= 30 ? (bday === 0 ? 'Cumple hoy' : `Cumple en ${bday} días`) : null
    ].filter(Boolean),
    suggestion: suggestionFor(customer, restaurant),
    rewards: rewards.map((x) => ({ id: x.id, description: x.description, expiresAt: x.expiresAt }))
  };
}

r.get('/staff/me', async (req, res) => {
  const [staff, rest] = await Promise.all([prisma.staff.findUniqueOrThrow({ where: { id: req.staff.id } }), loadRestaurant(req)]);
  res.json({ staff: { name: staff.name, role: staff.role }, restaurant: publicRestaurant(rest) });
});

r.get('/staff/customers/lookup', async (req, res) => {
  const rest = await loadRestaurant(req);
  let customer = null;
  if (req.query.phone) {
    const phone = normalizePhone(req.query.phone);
    if (!phone) throw new HttpError(400, 'invalid_phone', 'Escribe los 10 dígitos del celular.');
    customer = await prisma.customer.findUnique({ where: { restaurantId_phone: { restaurantId: rest.id, phone } } });
    if (!customer) return res.json({ found: false, phone: maskPhone(phone) });
  } else if (req.query.card) {
    customer = await prisma.customer.findUnique({ where: { cardToken: String(req.query.card) } });
    if (!customer || customer.restaurantId !== rest.id) throw new HttpError(404, 'card_not_found', 'Este pase no pertenece al Club de este restaurante.');
  } else {
    throw new HttpError(400, 'missing_query', 'Indica el celular o escanea el pase.');
  }
  res.json({ found: true, customer: await profile(customer, rest) });
});

const purchaseSchema = z.object({
  customerId: z.string().optional(),
  phone: z.string().optional(),
  amount: z.number().int().positive(),
  door: z.enum(['CASHIER', 'WALLET']).default('CASHIER')
});

// Confirmación de compra en caja. Si el número no existe, se crea el cliente y se le envía su tarjeta;
// el cliente acepta la autorización de datos al abrirla, y hasta entonces no recibe mensajes de marketing.
r.post('/staff/purchases', async (req, res) => {
  const rest = await loadRestaurant(req);
  const body = purchaseSchema.parse(req.body || {});
  let customer;
  let created = false;
  if (body.customerId) {
    customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer || customer.restaurantId !== rest.id) throw new HttpError(404, 'customer_not_found', 'Cliente no encontrado.');
  } else {
    const phone = normalizePhone(body.phone);
    if (!phone) throw new HttpError(400, 'invalid_phone', 'Escribe los 10 dígitos del celular.');
    ({ customer, created } = await upsertCustomer({ restaurant: rest, phone, consent: false, door: 'CASHIER' }));
    await prisma.entryEvent.create({ data: { restaurantId: rest.id, door: 'CASHIER', customerId: customer.id } });
  }

  const result = await awardPurchase({ restaurant: rest, customerId: customer.id, amount: body.amount, door: body.door, validation: 'CASHIER', staffId: req.staff.id });
  if (created) await sendCardLink(rest, result.customer);
  else await sendPurchaseReceipt(rest, result.customer, result.pointsAwarded);

  res.json({
    ok: true,
    newCustomer: created,
    pointsAwarded: result.pointsAwarded,
    rewardUnlocked: result.rewardUnlocked ? { description: result.rewardUnlocked.description } : null,
    customer: await profile(result.customer, rest)
  });
});

r.post('/staff/rewards/:id/redeem', async (req, res) => {
  const reward = await prisma.reward.findUnique({ where: { id: req.params.id } });
  if (!reward || reward.restaurantId !== req.staff.restaurantId) throw new HttpError(404, 'reward_not_found', 'Premio no encontrado.');
  if (reward.status !== 'AVAILABLE') throw new HttpError(409, 'reward_used', 'Este premio ya fue canjeado.');
  if (reward.expiresAt && reward.expiresAt < new Date()) throw new HttpError(422, 'reward_expired', 'Este premio ya venció.');
  const done = await prisma.reward.updateMany({ where: { id: reward.id, status: 'AVAILABLE' }, data: { status: 'REDEEMED', redeemedAt: new Date() } });
  if (!done.count) throw new HttpError(409, 'reward_used', 'Este premio ya fue canjeado.');
  res.json({ ok: true });
});

// Código para imprimir en el empaque de un domicilio. Vence en 7 días.
r.post('/staff/delivery-codes', async (req, res) => {
  const { amount } = z.object({ amount: z.number().int().positive().max(20_000_000) }).parse(req.body || {});
  for (let i = 0; i < 5; i++) {
    const code = randomCode(6);
    try {
      const dc = await prisma.deliveryCode.create({
        data: { restaurantId: req.staff.restaurantId, code, amount, expiresAt: new Date(Date.now() + 7 * 86400000) }
      });
      return res.json({ code: dc.code, amount: dc.amount, expiresAt: dc.expiresAt });
    } catch (e) {
      if (e.code !== 'P2002') throw e; // colisión de código: se reintenta
    }
  }
  throw new HttpError(500, 'code_generation', 'No se pudo generar el código. Intenta de nuevo.');
});

export default r;
