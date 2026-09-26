// Mensajes automáticos. Render lo ejecuta como Cron Job una vez al día (ver render.yaml).
// Solo escribe a clientes con autorización de datos vigente y sin baja.
import { prisma } from '../db.js';
import { sendTemplate } from '../lib/whatsapp.js';
import { riskOf, daysToBirthday } from '../lib/insights.js';
import { cardUrl, automationEnabled } from '../lib/customers.js';
import { firstName, bogotaMonthDay } from '../lib/util.js';

const DAY = 86400000;

async function sentSince(customerId, kind, date) {
  return prisma.messageLog.findFirst({ where: { customerId, kind, status: { in: ['SENT', 'SKIPPED_DEV'] }, createdAt: { gte: date } } });
}

export async function runAutomations(now = new Date()) {
  const summary = { birthday: 0, winback: 0, nearReward: 0, expired: 0 };

  // Premios vencidos
  const exp = await prisma.reward.updateMany({ where: { status: 'AVAILABLE', expiresAt: { lt: now } }, data: { status: 'EXPIRED' } });
  summary.expired = exp.count;

  const restaurants = await prisma.restaurant.findMany();
  for (const rest of restaurants) {
    const base = { restaurantId: rest.id, consentAt: { not: null }, optOut: false };

    // Cumpleaños: 5 días antes, un mensaje por año, con premio que vence a los 10 días.
    if (await automationEnabled(rest.id, 'BIRTHDAY')) {
      const { year } = bogotaMonthDay(now);
      const withBirthday = await prisma.customer.findMany({ where: { ...base, birthMonth: { not: null } } });
      for (const c of withBirthday) {
        if (daysToBirthday(c, now) !== 5) continue;
        if (await sentSince(c.id, 'BIRTHDAY', new Date(Date.UTC(year, 0, 1)))) continue;
        await prisma.reward.create({
          data: { restaurantId: rest.id, customerId: c.id, kind: 'BIRTHDAY', description: rest.birthdayRewardText, expiresAt: new Date(now.getTime() + 10 * DAY) }
        });
        // facil_cumpleanos: {{1}} nombre, {{2}} restaurante, {{3}} premio, {{4}} enlace
        await sendTemplate({ restaurantId: rest.id, customerId: c.id, to: c.phone, kind: 'BIRTHDAY', params: [firstName(c.name), rest.name, rest.birthdayRewardText, cardUrl(c)] });
        summary.birthday++;
      }
    }

    // Te extrañamos: en riesgo y sin invitación en los últimos 30 días.
    if (await automationEnabled(rest.id, 'WINBACK')) {
      const candidates = await prisma.customer.findMany({ where: { ...base, lastVisitAt: { lt: new Date(now.getTime() - 14 * DAY) } } });
      for (const c of candidates) {
        if (!riskOf(c, now)) continue;
        if (await sentSince(c.id, 'WINBACK', new Date(now.getTime() - 30 * DAY))) continue;
        await sendTemplate({ restaurantId: rest.id, customerId: c.id, to: c.phone, kind: 'WINBACK', params: [firstName(c.name), rest.name, cardUrl(c)] });
        summary.winback++;
      }
    }

    // Premio casi listo: le falta un sello y no se le ha avisado desde su última visita.
    if (await automationEnabled(rest.id, 'NEAR_REWARD')) {
      const near = await prisma.customer.findMany({
        where: { ...base, stamps: rest.stampsGoal - 1, lastVisitAt: { lt: new Date(now.getTime() - 7 * DAY) } }
      });
      for (const c of near) {
        if (await sentSince(c.id, 'NEAR_REWARD', c.lastVisitAt)) continue;
        // facil_premio_cerca: {{1}} nombre, {{2}} premio, {{3}} restaurante, {{4}} enlace
        await sendTemplate({ restaurantId: rest.id, customerId: c.id, to: c.phone, kind: 'NEAR_REWARD', params: [firstName(c.name), rest.rewardText, rest.name, cardUrl(c)] });
        summary.nearReward++;
      }
    }
  }
  return summary;
}

// Ejecución directa: `npm run automations`
if (import.meta.url === `file://${process.argv[1]}`) {
  runAutomations()
    .then((s) => { console.log('[automations]', s); return prisma.$disconnect(); })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
}
