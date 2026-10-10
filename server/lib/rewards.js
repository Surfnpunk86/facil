// Reglas del Club: puntos por monto, un sello por compra validada, premio al completar la tarjeta.
import { prisma } from '../db.js';
import { HttpError, startOfBogotaDay } from './util.js';
import { afterPurchase } from './games.js';

export function pointsFor(amount, restaurant) {
  return Math.floor(amount / 1000) * restaurant.pointsPerThousand;
}

/**
 * Registra una compra validada y actualiza el Club del cliente en una sola transacción.
 * Lanza HttpError si supera el tope diario o si la factura ya fue usada.
 */
export async function awardPurchase({ restaurant, customerId, amount, door, validation, invoiceKey = null, invoiceNumber = null, staffId = null }) {
  if (!Number.isInteger(amount) || amount <= 0) throw new HttpError(400, 'invalid_amount', 'El monto de la compra no es válido.');
  if (amount > 20_000_000) throw new HttpError(400, 'invalid_amount', 'El monto supera el máximo permitido para una compra.');

  const result = await prisma.$transaction(async (tx) => {
    const today = startOfBogotaDay();
    const todayCount = await tx.purchase.count({ where: { customerId, createdAt: { gte: today } } });
    if (todayCount >= restaurant.maxClaimsPerDay) {
      throw new HttpError(429, 'daily_limit', `Ya sumaste ${todayCount} compras hoy, el máximo del Club. Mañana puedes seguir sumando.`);
    }
    if (invoiceKey) {
      const used = await tx.purchase.findUnique({ where: { restaurantId_invoiceKey: { restaurantId: restaurant.id, invoiceKey } } });
      if (used) throw new HttpError(409, 'invoice_used', 'Esta factura ya se usó para sumar puntos.');
    }

    const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
    const points = pointsFor(amount, restaurant);
    let stamps = customer.stamps + 1;
    let reward = null;
    if (stamps >= restaurant.stampsGoal) {
      stamps = 0;
      reward = await tx.reward.create({
        data: {
          restaurantId: restaurant.id,
          customerId,
          kind: 'STAMP_CARD',
          description: restaurant.rewardText,
          expiresAt: new Date(Date.now() + 60 * 86400000)
        }
      });
    }

    const now = new Date();
    const purchase = await tx.purchase.create({
      data: { restaurantId: restaurant.id, customerId, amount, door, validation, invoiceKey, invoiceNumber, pointsAwarded: points, staffId }
    });
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        points: { increment: points },
        stamps,
        rewardsEarned: reward ? { increment: 1 } : undefined,
        visits: { increment: 1 },
        totalSpent: { increment: amount },
        lastVisitAt: now,
        firstVisitAt: customer.firstVisitAt ?? now
      }
    });
    return { purchase, customer: updated, pointsAwarded: points, rewardUnlocked: reward };
  });

  // Juegos de la red: boletas, láminas y retos. Un fallo aquí no anula la compra ya registrada.
  try {
    result.extras = await afterPurchase({ restaurant, customer: result.customer, purchase: result.purchase });
    if (result.extras.challenges.length) {
      result.customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    }
  } catch (e) {
    console.error('[juegos] error después de la compra', e);
    result.extras = { tickets: [], sticker: null, albumCompleted: null, challenges: [] };
  }
  return result;
}
