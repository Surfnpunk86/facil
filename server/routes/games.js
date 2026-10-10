// Panel del administrador: meseros, retos del restaurante y estado de la red (álbum y factura premiada).
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireStaff, requireOwner } from '../auth.js';
import { HttpError } from '../lib/util.js';
import { config } from '../config.js';

const r = Router();
r.use('/panel/games', requireStaff, requireOwner);
r.use('/panel/waiters', requireStaff, requireOwner);
r.use('/panel/challenges', requireStaff, requireOwner);

const since = (days) => new Date(Date.now() - days * 86400000);

r.get('/panel/games', async (req, res) => {
  const rid = req.staff.restaurantId;
  const from = since(30);
  const rest = await prisma.restaurant.findUniqueOrThrow({ where: { id: rid }, include: { zone: { include: { restaurants: { select: { id: true, name: true } } } } } });

  // Ranking de meseros: inscritos en 30 días, cuántos volvieron y lo que han comprado.
  const waiters = await prisma.waiter.findMany({ where: { restaurantId: rid }, orderBy: { name: 'asc' } });
  const ranking = [];
  for (const w of waiters) {
    const customers = await prisma.customer.findMany({ where: { waiterId: w.id }, select: { id: true, visits: true, totalSpent: true, createdAt: true } });
    const recent = customers.filter((c) => c.createdAt >= from);
    ranking.push({
      id: w.id, name: w.name, code: w.code, active: w.active,
      enrolled30d: recent.length,
      returned: customers.filter((c) => c.visits >= 2).length,
      enrolledTotal: customers.length,
      sales: customers.reduce((s, c) => s + c.totalSpent, 0),
      qrUrl: `${config.publicUrl}/r/${rest.slug}?via=qr&m=${encodeURIComponent(w.code)}`
    });
  }
  ranking.sort((a, b) => b.enrolled30d - a.enrolled30d || b.returned - a.returned);

  const challenges = await prisma.challenge.findMany({
    where: { OR: [{ restaurantId: rid }, ...(rest.zoneId ? [{ zoneId: rest.zoneId, restaurantId: null }] : [])] },
    orderBy: [{ active: 'desc' }, { endsAt: 'desc' }],
    include: { _count: { select: { completions: true } } }
  });

  let zone = null;
  if (rest.zone) {
    const completions = await prisma.albumCompletion.count({ where: { zoneId: rest.zone.id, seasonStart: rest.zone.seasonStart } });
    zone = {
      name: rest.zone.name, rewardText: rest.zone.rewardText, seasonStart: rest.zone.seasonStart, seasonEnd: rest.zone.seasonEnd,
      restaurants: rest.zone.restaurants.map((x) => x.name), completions,
      completedHere: await prisma.albumCompletion.count({ where: { zoneId: rest.zone.id, restaurantId: rid } })
    };
  }

  const draws = await prisma.draw.findMany({
    where: { status: { in: ['ACTIVE', 'CLOSED', 'DRAWN'] }, OR: [{ zoneId: null }, ...(rest.zoneId ? [{ zoneId: rest.zoneId }] : [])] },
    orderBy: { drawAt: 'desc' },
    take: 5
  });
  const drawStats = [];
  for (const d of draws) {
    drawStats.push({
      id: d.id, name: d.name, prizeText: d.prizeText, sponsorName: d.sponsorName, status: d.status, drawAt: d.drawAt, endsAt: d.endsAt,
      authorization: d.coljuegosAuthorization,
      ticketsTotal: await prisma.drawTicket.count({ where: { drawId: d.id } }),
      ticketsHere: await prisma.drawTicket.count({ where: { drawId: d.id, purchase: { restaurantId: rid } } })
    });
  }

  res.json({
    ranking,
    challenges: challenges.map((c) => ({
      id: c.id, title: c.title, description: c.description, kind: c.kind, target: c.target, bonusPoints: c.bonusPoints,
      sponsorName: c.sponsorName, startsAt: c.startsAt, endsAt: c.endsAt, active: c.active,
      scope: c.restaurantId ? 'RESTAURANT' : 'ZONE', editable: c.restaurantId === rid, completions: c._count.completions
    })),
    zone,
    draws: drawStats
  });
});

const waiterSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del mesero.').max(60),
  code: z.string().trim().regex(/^[A-Za-z0-9]{2,12}$/, 'El código debe tener de 2 a 12 letras o números, sin espacios.')
});

r.post('/panel/waiters', async (req, res) => {
  const body = waiterSchema.parse(req.body || {});
  try {
    const w = await prisma.waiter.create({ data: { restaurantId: req.staff.restaurantId, name: body.name, code: body.code.toUpperCase() } });
    res.json({ waiter: w });
  } catch (e) {
    if (e.code === 'P2002') throw new HttpError(409, 'waiter_exists', 'Ya hay un mesero con ese código.');
    throw e;
  }
});

r.put('/panel/waiters/:id', async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body || {});
  const w = await prisma.waiter.findUnique({ where: { id: req.params.id } });
  if (!w || w.restaurantId !== req.staff.restaurantId) throw new HttpError(404, 'not_found', 'Mesero no encontrado.');
  res.json({ waiter: await prisma.waiter.update({ where: { id: w.id }, data: { active } }) });
});

const challengeSchema = z.object({
  title: z.string().trim().min(3, 'Escribe el nombre del reto.').max(80),
  description: z.string().max(200).optional(),
  kind: z.enum(['VISITS', 'SPEND', 'STREAK_WEEKS']),
  target: z.number().int().positive().max(100_000_000),
  bonusPoints: z.number().int().min(1).max(100_000),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date()
}).refine((c) => c.endsAt > c.startsAt, { message: 'La fecha de cierre debe ser posterior a la de inicio.', path: ['endsAt'] });

r.post('/panel/challenges', async (req, res) => {
  const body = challengeSchema.parse(req.body || {});
  const c = await prisma.challenge.create({ data: { ...body, restaurantId: req.staff.restaurantId } });
  res.json({ challenge: c });
});

r.put('/panel/challenges/:id', async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body || {});
  const c = await prisma.challenge.findUnique({ where: { id: req.params.id } });
  if (!c || c.restaurantId !== req.staff.restaurantId) throw new HttpError(404, 'not_found', 'Reto no encontrado o administrado por la red.');
  res.json({ challenge: await prisma.challenge.update({ where: { id: c.id }, data: { active } }) });
});

export default r;
