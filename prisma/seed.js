// Datos de demostración: un restaurante, sus piezas de mesa, dos usuarios y clientes de ejemplo.
// Uso: npm run seed  (no ejecutar en la base de datos de un cliente real)
import bcrypt from 'bcryptjs';
import { prisma } from '../server/db.js';
import { randomBytes } from 'node:crypto';

const DAY = 86400000;
const token = () => randomBytes(18).toString('base64url');

const ownerPass = process.env.SEED_OWNER_PASSWORD || 'facil-demo-2026';
const cashierPass = process.env.SEED_CASHIER_PASSWORD || 'caja-demo-2026';

async function main() {
  const existing = await prisma.restaurant.findUnique({ where: { slug: 'arepa-y-brasa' } });
  if (existing) {
    console.log('El restaurante de demostración ya existe; no se modifica.');
    return;
  }

  const r = await prisma.restaurant.create({
    data: {
      slug: 'arepa-y-brasa',
      name: 'Arepa & Brasa',
      nit: '901234567',
      city: 'Barranquilla',
      pointsPerThousand: 1,
      stampsGoal: 8,
      rewardText: 'Parrillada para 2',
      birthdayRewardText: 'Picada de cumpleaños por la casa',
      googleReviewUrl: 'https://search.google.com/local/writereview?placeid=REEMPLAZAR_PLACE_ID',
      ownerAlertPhone: '+573001112233'
    }
  });

  const tags = [...Array.from({ length: 8 }, (_, i) => ({ code: `MESA-${i + 1}`, label: `Mesa ${i + 1}` })), { code: 'CAJA-1', label: 'Mostrador' }];
  await prisma.tag.createMany({ data: tags.map((t) => ({ ...t, restaurantId: r.id })) });

  await prisma.staff.createMany({
    data: [
      { restaurantId: r.id, name: 'Administrador demo', email: 'admin@facil.demo', passwordHash: await bcrypt.hash(ownerPass, 10), role: 'OWNER' },
      { restaurantId: r.id, name: 'Caja demo', email: 'caja@facil.demo', passwordHash: await bcrypt.hash(cashierPass, 10), role: 'CASHIER' }
    ]
  });

  // Clientes de ejemplo: [nombre, celular, cumpleaños MM-DD, visitas, ticket, días desde la última visita, puerta habitual]
  const sample = [
    ['Valentina Rojas', '3005551234', '11-14', 7, 86000, 19, 'QR'],
    ['Carlos Méndez', '3015550001', '03-02', 11, 142000, 34, 'NFC'],
    ['Laura Pacheco', '3025550002', '07-21', 8, 98000, 27, 'CASHIER'],
    ['Andrés Llinás', '3105550003', '01-30', 6, 76000, 22, 'NFC'],
    ['Sofía Barrios', '3115550004', null, 5, 64000, 3, 'WHATSAPP'],
    ['Mateo Cabrera', '3125550005', '12-05', 3, 52000, 6, 'QR'],
    ['Isabella Gómez', '3135550006', '09-30', 2, 71000, 10, 'WALLET'],
    ['Juan David Ruiz', '3145550007', null, 1, 45000, 40, 'DELIVERY_CODE']
  ];
  const now = Date.now();
  for (const [name, cel, bday, visits, ticket, lastAgo, door] of sample) {
    const interval = visits > 1 ? Math.max(4, Math.round(60 / visits)) : 0;
    const firstAgo = lastAgo + interval * (visits - 1);
    const [bm, bd] = bday ? bday.split('-').map(Number) : [null, null];
    const stamps = visits % 8;
    const c = await prisma.customer.create({
      data: {
        restaurantId: r.id, name, phone: `+57${cel}`, birthMonth: bm, birthDay: bd,
        consentAt: new Date(now - firstAgo * DAY), consentVersion: '2026-09', cardToken: token(),
        points: Math.floor((ticket * visits) / 1000), stamps, rewardsEarned: Math.floor(visits / 8),
        visits, totalSpent: ticket * visits, firstVisitAt: new Date(now - firstAgo * DAY), lastVisitAt: new Date(now - lastAgo * DAY),
        joinedVia: door, createdAt: new Date(now - firstAgo * DAY)
      }
    });
    for (let v = 0; v < visits; v++) {
      const at = new Date(now - (firstAgo - interval * v) * DAY);
      const amount = Math.round((ticket * (0.8 + ((v * 37) % 40) / 100)) / 100) * 100;
      const validation = door === 'CASHIER' || door === 'WALLET' ? 'CASHIER' : door === 'DELIVERY_CODE' ? 'DELIVERY_CODE' : 'INVOICE';
      await prisma.purchase.create({
        data: {
          restaurantId: r.id, customerId: c.id, amount, door, validation,
          invoiceKey: validation === 'INVOICE' ? randomBytes(24).toString('hex') : null,
          pointsAwarded: Math.floor(amount / 1000), createdAt: at
        }
      });
      await prisma.entryEvent.create({ data: { restaurantId: r.id, customerId: c.id, door: door === 'DELIVERY_CODE' ? 'QR' : door, createdAt: at } });
    }
  }

  await prisma.feedback.createMany({
    data: [
      { restaurantId: r.id, rating: 5, comment: 'La picada estuvo buenísima', createdAt: new Date(now - 2 * DAY) },
      { restaurantId: r.id, rating: 2, comment: 'La picada llegó fría', createdAt: new Date(now - 1 * DAY) }
    ]
  });

  console.log('Demo lista: /r/arepa-y-brasa · admin@facil.demo / ' + ownerPass + ' · caja@facil.demo / ' + cashierPass);
}

main().finally(() => prisma.$disconnect());
