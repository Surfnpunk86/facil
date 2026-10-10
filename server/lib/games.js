// Red de beneficios y juegos: rachas, retos, álbum por zona y factura premiada.
// Todo se calcula sobre compras validadas; un toque o un escaneo sin compra no cuenta.
// El cliente se reconoce en toda la red por su celular (cada restaurante tiene su propio registro).
import { randomInt } from 'node:crypto';
import { prisma } from '../db.js';

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const WEEK_MS = 7 * 86400000;

// Lunes 00:00 (hora de Bogotá) de la semana de `date`, expresado como número de semana absoluto.
export function weekIndex(date) {
  const local = new Date(new Date(date).getTime() + BOGOTA_OFFSET_MS);
  const day = (local.getUTCDay() + 6) % 7; // lunes = 0
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day);
  return Math.round(monday / WEEK_MS);
}

/**
 * Racha semanal: semanas seguidas con al menos una compra, contando hacia atrás desde esta semana.
 * Si esta semana aún no hay compra, la racha sigue viva con las semanas anteriores.
 */
export function weeklyStreak(dates, now = new Date()) {
  const weeks = new Set(dates.map(weekIndex));
  const current = weekIndex(now);
  const activeThisWeek = weeks.has(current);
  let w = activeThisWeek ? current : current - 1;
  let count = 0;
  while (weeks.has(w)) { count++; w--; }
  return { weeks: count, activeThisWeek };
}

// Progreso de un reto con las compras dentro de su ventana.
export function challengeProgress(challenge, purchases, now = new Date()) {
  const inWindow = purchases.filter((p) => p.createdAt >= challenge.startsAt && p.createdAt <= challenge.endsAt);
  let value = 0;
  if (challenge.kind === 'VISITS') value = inWindow.length;
  else if (challenge.kind === 'SPEND') value = inWindow.reduce((s, p) => s + p.amount, 0);
  else if (challenge.kind === 'STREAK_WEEKS') value = weeklyStreak(inWindow.map((p) => p.createdAt), now).weeks;
  return { value, target: challenge.target, done: value >= challenge.target };
}

// Compras validadas del cliente en el alcance de un reto o de una zona.
async function purchasesForPhone(phone, { restaurantId = null, zoneId = null, since = null } = {}) {
  return prisma.purchase.findMany({
    where: {
      customer: { phone },
      ...(restaurantId ? { restaurantId } : {}),
      ...(zoneId ? { restaurant: { zoneId } } : {}),
      ...(since ? { createdAt: { gte: since } } : {})
    },
    select: { id: true, amount: true, createdAt: true, restaurantId: true },
    orderBy: { createdAt: 'asc' }
  });
}

function seasonActive(zone, now = new Date()) {
  return zone && zone.seasonStart <= now && zone.seasonEnd >= now;
}

async function applicableChallenges(restaurant, now = new Date()) {
  return prisma.challenge.findMany({
    where: {
      active: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [{ restaurantId: restaurant.id }, ...(restaurant.zoneId ? [{ zoneId: restaurant.zoneId, restaurantId: null }] : [])]
    },
    orderBy: { endsAt: 'asc' }
  });
}

// Sorteos activos que aplican a este restaurante. Sin número de autorización de Coljuegos, ninguno emite boletas.
async function applicableDraws(restaurant, now = new Date()) {
  return prisma.draw.findMany({
    where: {
      status: 'ACTIVE',
      coljuegosAuthorization: { not: null },
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [{ zoneId: null }, ...(restaurant.zoneId ? [{ zoneId: restaurant.zoneId }] : [])]
    },
    orderBy: { drawAt: 'asc' }
  });
}

async function issueTicket(draw, purchase, customer) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.drawTicket.findFirst({ where: { drawId: draw.id }, orderBy: { number: 'desc' }, select: { number: true } });
    try {
      return await prisma.drawTicket.create({
        data: { drawId: draw.id, number: (last?.number || 0) + 1, purchaseId: purchase.id, customerId: customer.id, phone: customer.phone }
      });
    } catch (e) {
      if (e.code !== 'P2002') throw e;
      const existing = await prisma.drawTicket.findUnique({ where: { purchaseId: purchase.id } });
      if (existing) return existing; // la compra ya tenía boleta
    }
  }
  throw new Error('No se pudo asignar número de boleta');
}

/**
 * Se ejecuta después de cada compra validada. Devuelve lo que el cliente ganó además de puntos y sello:
 * boletas, lámina nueva, página del álbum completa y retos cumplidos.
 */
export async function afterPurchase({ restaurant, customer, purchase, now = new Date() }) {
  const extras = { tickets: [], sticker: null, albumCompleted: null, challenges: [] };

  // 1. Factura premiada
  for (const draw of await applicableDraws(restaurant, now)) {
    const t = await issueTicket(draw, purchase, customer);
    extras.tickets.push({ drawName: draw.name, prizeText: draw.prizeText, number: t.number, drawAt: draw.drawAt });
  }

  // 2. Álbum de la zona
  const zone = restaurant.zoneId ? await prisma.zone.findUnique({ where: { id: restaurant.zoneId } }) : null;
  if (seasonActive(zone, now)) {
    const [zoneRestaurants, inSeason] = await Promise.all([
      prisma.restaurant.findMany({ where: { zoneId: zone.id }, select: { id: true } }),
      purchasesForPhone(customer.phone, { zoneId: zone.id, since: zone.seasonStart })
    ]);
    const collected = new Set(inSeason.map((p) => p.restaurantId));
    const isNew = inSeason.filter((p) => p.restaurantId === restaurant.id).length === 1;
    extras.sticker = { isNew, collected: collected.size, total: zoneRestaurants.length, zoneName: zone.name, restaurantName: restaurant.name };

    if (zoneRestaurants.length > 1 && zoneRestaurants.every((r) => collected.has(r.id))) {
      try {
        const completion = await prisma.albumCompletion.create({
          data: { zoneId: zone.id, phone: customer.phone, seasonStart: zone.seasonStart, restaurantId: restaurant.id }
        });
        const reward = await prisma.reward.create({
          data: { restaurantId: restaurant.id, customerId: customer.id, kind: 'ALBUM', description: zone.rewardText, expiresAt: new Date(now.getTime() + 60 * 86400000) }
        });
        await prisma.albumCompletion.update({ where: { id: completion.id }, data: { rewardId: reward.id } });
        extras.albumCompleted = { zoneName: zone.name, rewardText: zone.rewardText };
      } catch (e) {
        if (e.code !== 'P2002') throw e; // ya la había completado esta temporada
      }
    }
  }

  // 3. Retos
  for (const ch of await applicableChallenges(restaurant, now)) {
    const done = await prisma.challengeCompletion.findUnique({ where: { challengeId_phone: { challengeId: ch.id, phone: customer.phone } } });
    if (done) continue;
    const scope = ch.restaurantId ? { restaurantId: ch.restaurantId } : { zoneId: ch.zoneId };
    const progress = challengeProgress(ch, await purchasesForPhone(customer.phone, { ...scope, since: ch.startsAt }), now);
    if (!progress.done) continue;
    try {
      await prisma.$transaction([
        prisma.challengeCompletion.create({ data: { challengeId: ch.id, phone: customer.phone, customerId: customer.id, pointsAwarded: ch.bonusPoints } }),
        prisma.customer.update({ where: { id: customer.id }, data: { points: { increment: ch.bonusPoints } } })
      ]);
      extras.challenges.push({ title: ch.title, bonusPoints: ch.bonusPoints, sponsorName: ch.sponsorName });
    } catch (e) {
      if (e.code !== 'P2002') throw e;
    }
  }
  return extras;
}

// Lo que ve el cliente en su tarjeta: racha, retos con progreso, álbum de su zona y sus boletas.
export async function gamesView(customer, restaurant, now = new Date()) {
  const all = await purchasesForPhone(customer.phone);
  const streak = weeklyStreak(all.map((p) => p.createdAt), now);

  const challenges = [];
  for (const ch of await applicableChallenges(restaurant, now)) {
    const done = await prisma.challengeCompletion.findUnique({ where: { challengeId_phone: { challengeId: ch.id, phone: customer.phone } } });
    const scoped = all.filter((p) => (ch.restaurantId ? p.restaurantId === ch.restaurantId : true));
    const zoneScoped = ch.restaurantId ? scoped : await purchasesForPhone(customer.phone, { zoneId: ch.zoneId, since: ch.startsAt });
    const progress = challengeProgress(ch, zoneScoped, now);
    challenges.push({
      id: ch.id, title: ch.title, description: ch.description, kind: ch.kind, target: ch.target,
      value: Math.min(progress.value, ch.target), done: Boolean(done), bonusPoints: ch.bonusPoints,
      sponsorName: ch.sponsorName, endsAt: ch.endsAt, scope: ch.restaurantId ? 'RESTAURANT' : 'ZONE'
    });
  }

  let album = null;
  const zone = restaurant.zoneId ? await prisma.zone.findUnique({ where: { id: restaurant.zoneId }, include: { restaurants: { select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } } } }) : null;
  if (zone) {
    const inSeason = all.filter((p) => p.createdAt >= zone.seasonStart && p.createdAt <= zone.seasonEnd);
    const collected = new Set(inSeason.map((p) => p.restaurantId));
    const completion = await prisma.albumCompletion.findUnique({ where: { zoneId_phone_seasonStart: { zoneId: zone.id, phone: customer.phone, seasonStart: zone.seasonStart } } });
    album = {
      zoneName: zone.name, rewardText: zone.rewardText, seasonEnd: zone.seasonEnd, active: seasonActive(zone, now),
      completed: Boolean(completion),
      stickers: zone.restaurants.map((r) => ({ name: r.name, slug: r.slug, collected: collected.has(r.id), here: r.id === restaurant.id }))
    };
  }

  const draws = [];
  for (const d of await applicableDraws(restaurant, now)) {
    const mine = await prisma.drawTicket.findMany({ where: { drawId: d.id, phone: customer.phone }, orderBy: { number: 'desc' }, select: { number: true } });
    draws.push({
      id: d.id, name: d.name, prizeText: d.prizeText, sponsorName: d.sponsorName, drawAt: d.drawAt, endsAt: d.endsAt,
      authorization: d.coljuegosAuthorization, termsUrl: d.termsUrl, ticketCount: mine.length, lastNumbers: mine.slice(0, 5).map((t) => t.number)
    });
  }
  return { streak, challenges, album, draws };
}

/**
 * Sortea un ganador entre las boletas de un sorteo cerrado. Devuelve la boleta ganadora y la huella SHA-256
 * de la lista completa, para dejar constancia ante el delegado de Coljuegos o el notario.
 */
export async function runDraw(drawId) {
  const draw = await prisma.draw.findUnique({ where: { id: drawId } });
  if (!draw) throw new Error('Sorteo no encontrado');
  if (draw.status !== 'CLOSED') throw new Error('El sorteo debe estar cerrado antes de sortear');
  const tickets = await prisma.drawTicket.findMany({ where: { drawId }, orderBy: { number: 'asc' } });
  if (!tickets.length) throw new Error('El sorteo no tiene boletas');
  const { createHash } = await import('node:crypto');
  const fingerprint = createHash('sha256').update(tickets.map((t) => `${t.number}:${t.phone}:${t.purchaseId}`).join('\n')).digest('hex');
  const winner = tickets[randomInt(tickets.length)];
  await prisma.draw.update({ where: { id: drawId }, data: { status: 'DRAWN', winnerTicketId: winner.id, drawnAt: new Date() } });
  return { winner, total: tickets.length, fingerprint };
}
