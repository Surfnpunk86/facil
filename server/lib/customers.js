// Alta de clientes, vista pública de la tarjeta y mensajes asociados.
import { prisma } from '../db.js';
import { config } from '../config.js';
import { sendTemplate } from './whatsapp.js';
import { firstName, randomToken, HttpError } from './util.js';
import { googleWalletSaveUrl } from './wallet.js';
import { gamesView } from './games.js';

export const cardUrl = (customer) => `${config.publicUrl}/c/${customer.cardToken}`;

export async function getRestaurantBySlug(slug) {
  const r = await prisma.restaurant.findUnique({ where: { slug } });
  if (!r) throw new HttpError(404, 'restaurant_not_found', 'No encontramos este establecimiento.');
  return r;
}

export async function automationEnabled(restaurantId, key) {
  const a = await prisma.automation.findUnique({ where: { restaurantId_key: { restaurantId, key } } });
  return a ? a.enabled : true;
}

/**
 * Crea el cliente si no existe. Devuelve { customer, created }.
 * `consent` = true solo cuando el cliente marcó la autorización él mismo.
 */
export async function upsertCustomer({ restaurant, phone, name, birthMonth, birthDay, consent, door, waiterId = null }) {
  const existing = await prisma.customer.findUnique({ where: { restaurantId_phone: { restaurantId: restaurant.id, phone } } });
  if (existing) {
    const data = {};
    if (!existing.name && name) data.name = name;
    if (!existing.birthMonth && birthMonth && birthDay) Object.assign(data, { birthMonth, birthDay });
    if (consent && !existing.consentAt) Object.assign(data, { consentAt: new Date(), consentVersion: config.consentVersion, optOut: false });
    const customer = Object.keys(data).length ? await prisma.customer.update({ where: { id: existing.id }, data }) : existing;
    return { customer, created: false };
  }
  const customer = await prisma.customer.create({
    data: {
      restaurantId: restaurant.id,
      phone,
      name: name || null,
      birthMonth: birthMonth || null,
      birthDay: birthDay || null,
      consentAt: consent ? new Date() : null,
      consentVersion: consent ? config.consentVersion : null,
      cardToken: randomToken(),
      joinedVia: door || null,
      waiterId
    }
  });
  return { customer, created: true };
}

// Plantilla facil_bienvenida: {{1}} nombre, {{2}} restaurante, {{3}} enlace de la tarjeta.
export async function sendWelcome(restaurant, customer) {
  if (customer.optOut || !(await automationEnabled(restaurant.id, 'WELCOME'))) return;
  await sendTemplate({
    restaurantId: restaurant.id, customerId: customer.id, to: customer.phone, kind: 'WELCOME',
    params: [firstName(customer.name), restaurant.name, cardUrl(customer)]
  });
}

// Plantilla facil_tarjeta: {{1}} restaurante, {{2}} enlace. Se usa cuando alguien pide su tarjeta con un
// número ya inscrito, y cuando el cajero inscribe a un cliente nuevo (el cliente acepta los términos al abrirla).
export async function sendCardLink(restaurant, customer) {
  await sendTemplate({
    restaurantId: restaurant.id, customerId: customer.id, to: customer.phone, kind: 'CARD_LINK',
    params: [restaurant.name, cardUrl(customer)]
  });
}

// Plantilla facil_compra: {{1}} nombre, {{2}} puntos sumados, {{3}} sellos "x/8", {{4}} enlace.
export async function sendPurchaseReceipt(restaurant, customer, pointsAwarded) {
  if (customer.optOut) return;
  await sendTemplate({
    restaurantId: restaurant.id, customerId: customer.id, to: customer.phone, kind: 'PURCHASE',
    params: [firstName(customer.name), pointsAwarded, `${customer.stamps}/${restaurant.stampsGoal}`, cardUrl(customer)]
  });
}

export async function cardView(customer, restaurant) {
  const rewards = await prisma.reward.findMany({
    where: { customerId: customer.id, status: 'AVAILABLE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: 'asc' }
  });
  return {
    token: customer.cardToken,
    name: customer.name,
    phoneLast4: customer.phone.slice(-4),
    points: customer.points,
    stamps: customer.stamps,
    visits: customer.visits,
    needsConsent: !customer.consentAt,
    rewards: rewards.map((r) => ({ id: r.id, kind: r.kind, description: r.description, expiresAt: r.expiresAt })),
    googleWalletUrl: googleWalletSaveUrl({ restaurant, customer }),
    games: await gamesView(customer, restaurant),
    restaurant: publicRestaurant(restaurant)
  };
}

export function publicRestaurant(r) {
  return {
    slug: r.slug,
    name: r.name,
    city: r.city,
    stampsGoal: r.stampsGoal,
    rewardText: r.rewardText,
    pointsPerThousand: r.pointsPerThousand,
    googleReviewUrl: r.googleReviewUrl
  };
}
