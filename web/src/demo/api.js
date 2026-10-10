// Versión de revisión: reemplaza la API real por un servidor simulado en memoria, con datos de ejemplo.
// Reproduce las reglas del backend (compra validada, tope diario, sellos, retos, álbum, factura premiada)
// para que las pantallas se comporten igual que en producción. Se usa solo en `npm run build:demo`.

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const mem = {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
  del(k) { try { localStorage.removeItem(k); } catch { delete mem[k]; } }
};
const STAFF_KEY = 'facil_demo_staff';
export function getStaffSession() { try { return JSON.parse(store.get(STAFF_KEY)) || null; } catch { return null; } }
export function setStaffSession(s) { s ? store.set(STAFF_KEY, JSON.stringify(s)) : store.del(STAFF_KEY); }
const cardKey = (slug) => `facil_demo_card_${slug}`;
export function savedCard(slug) { return store.get(cardKey(slug)); }
export function saveCard(slug, token) { store.set(cardKey(slug), token); }
export const cop = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO');
export const formatPhone = (d) => d.replace(/\D/g, '').slice(0, 10).replace(/(\d{3})(\d{0,3})(\d{0,4})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '));

// ---------------------------------------------------------------- datos de ejemplo
const DAY = 86400000;
const BOG = -5 * 3600000;
let seq = 1000;
const id = (p) => `${p}${++seq}`;
const tok = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);

let db;
let lastRestaurantId = 'r1';
export function resetDemo() {
  seq = 1000;
  const now = Date.now();
  const ago = (d) => new Date(now - d * DAY);
  const zone = { id: 'z1', slug: 'ruta-del-prado', name: 'Ruta del Prado', rewardText: 'Cena para 2 en un restaurante de la ruta', seasonStart: ago(20), seasonEnd: new Date(now + 100 * DAY) };
  const base = { pointsPerThousand: 1, stampsGoal: 8, maxClaimsPerDay: 2, invoiceMaxAgeHours: 48, city: 'Barranquilla', zoneId: 'z1', googleReviewUrl: 'https://www.google.com/maps', ownerAlertPhone: '+573001112233', birthdayRewardText: 'Picada de cumpleaños por la casa' };
  db = {
    zones: [zone],
    restaurants: [
      { ...base, id: 'r1', slug: 'arepa-y-brasa', name: 'Arepa & Brasa', nit: '901234567', rewardText: 'Parrillada para 2' },
      { ...base, id: 'r2', slug: 'cafe-del-prado', name: 'Café del Prado', nit: '901765432', rewardText: 'Café y pastel de la casa' },
      { ...base, id: 'r3', slug: 'la-esquina', name: 'La Esquina', nit: '900123456', rewardText: 'Postre de la casa' }
    ],
    tags: [...Array.from({ length: 8 }, (_, i) => ({ id: `t${i + 1}`, restaurantId: 'r1', code: `MESA-${i + 1}`, label: `Mesa ${i + 1}`, active: true })), { id: 't9', restaurantId: 'r1', code: 'CAJA-1', label: 'Mostrador', active: true }],
    waiters: [
      { id: 'w1', restaurantId: 'r1', name: 'Luis Pérez', code: 'LUIS', active: true },
      { id: 'w2', restaurantId: 'r1', name: 'Andrea Molina', code: 'ANDREA', active: true },
      { id: 'w3', restaurantId: 'r1', name: 'Kevin Ortiz', code: 'KEVIN', active: true }
    ],
    customers: [], purchases: [], rewards: [], tickets: [], completions: [], challengeDone: [], messages: [], deliveryCodes: [],
    feedback: [
      { id: 'f1', restaurantId: 'r1', customerId: null, rating: 5, comment: 'La picada estuvo buenísima', createdAt: ago(2), handledAt: null },
      { id: 'f2', restaurantId: 'r1', customerId: null, rating: 2, comment: 'La picada llegó fría', createdAt: ago(1), handledAt: null }
    ],
    automations: { WELCOME: true, WINBACK: true, BIRTHDAY: true, NEAR_REWARD: false, LOW_RATING: true },
    challenges: [
      { id: 'ch1', restaurantId: 'r1', zoneId: null, title: 'Tres almuerzos este mes', description: 'Tres compras validadas antes de fin de mes', kind: 'VISITS', target: 3, bonusPoints: 150, sponsorName: null, startsAt: ago(6), endsAt: new Date(now + 24 * DAY), active: true },
      { id: 'ch2', restaurantId: 'r1', zoneId: null, title: 'Dos semanas seguidas', description: null, kind: 'STREAK_WEEKS', target: 2, bonusPoints: 100, sponsorName: null, startsAt: ago(20), endsAt: new Date(now + 40 * DAY), active: true },
      { id: 'ch3', restaurantId: null, zoneId: 'z1', title: 'Recorre la Ruta del Prado', description: 'Tres compras en cualquier restaurante de la ruta', kind: 'VISITS', target: 3, bonusPoints: 300, sponsorName: 'Marca aliada', startsAt: ago(6), endsAt: new Date(now + 24 * DAY), active: true }
    ],
    draws: [
      { id: 'd1', zoneId: null, name: 'Factura premiada de noviembre', prizeText: 'Moto eléctrica 0 km', sponsorName: 'Marca aliada', startsAt: ago(6), endsAt: new Date(now + 55 * DAY), drawAt: new Date(now + 60 * DAY), coljuegosAuthorization: 'Autorización Coljuegos No. pendiente (ejemplo)', termsUrl: null, status: 'ACTIVE' }
    ]
  };
  // [nombre, celular, cumpleaños MM-DD, visitas, ticket, días desde la última, puerta, mesero]
  const sample = [
    ['Valentina Rojas', '3005551234', '11-14', 7, 86000, 19, 'QR', 'w1'],
    ['Carlos Méndez', '3015550001', '03-02', 11, 142000, 34, 'NFC', 'w2'],
    ['Laura Pacheco', '3025550002', '07-21', 8, 98000, 27, 'CASHIER', 'w1'],
    ['Andrés Llinás', '3105550003', '01-30', 6, 76000, 22, 'NFC', null],
    ['Sofía Barrios', '3115550004', null, 5, 64000, 3, 'WHATSAPP', 'w1'],
    ['Mateo Cabrera', '3125550005', '12-05', 3, 52000, 6, 'QR', 'w2'],
    ['Isabella Gómez', '3135550006', '09-30', 2, 71000, 10, 'WALLET', 'w3'],
    ['Juan David Ruiz', '3145550007', null, 1, 45000, 40, 'DELIVERY_CODE', null]
  ];
  for (const [name, cel, bday, visits, ticket, lastAgo, door, waiterId] of sample) {
    const interval = visits > 1 ? Math.max(4, Math.round(60 / visits)) : 0;
    const firstAgo = lastAgo + interval * (visits - 1);
    const [bm, bd] = bday ? bday.split('-').map(Number) : [null, null];
    const c = addCustomer({ restaurantId: 'r1', name, phone: `+57${cel}`, birthMonth: bm, birthDay: bd, consent: true, door, waiterId, createdAt: ago(firstAgo), token: cel === '3005551234' ? 'demo-valentina' : undefined });
    for (let v = 0; v < visits; v++) {
      const amount = Math.round((ticket * (0.8 + ((v * 37) % 40) / 100)) / 100) * 100;
      recordPurchase({ restaurant: db.restaurants[0], customer: c, amount, door, validation: door === 'CASHIER' || door === 'WALLET' ? 'CASHIER' : door === 'DELIVERY_CODE' ? 'DELIVERY_CODE' : 'INVOICE', at: ago(firstAgo - interval * v), silent: true });
    }
  }
  // Valentina ya tiene la lámina de Café del Prado; le falta La Esquina para completar la página.
  const v2 = addCustomer({ restaurantId: 'r2', name: 'Valentina Rojas', phone: '+573005551234', consent: true, door: 'QR', createdAt: ago(9) });
  recordPurchase({ restaurant: db.restaurants[1], customer: v2, amount: 23500, door: 'QR', validation: 'INVOICE', at: ago(9), silent: true });
  // Unos clientes más en las otras zonas para el ranking del sorteo
  for (const [i, cel] of ['3167770001', '3167770002', '3167770003'].entries()) {
    const c = addCustomer({ restaurantId: 'r2', name: `Cliente ${i + 1}`, phone: `+57${cel}`, consent: true, door: 'QR', createdAt: ago(5) });
    recordPurchase({ restaurant: db.restaurants[1], customer: c, amount: 18000 + i * 4000, door: 'QR', validation: 'INVOICE', at: ago(4 - i) });
  }
  // Valentina completó la tarjeta antes: el premio está listo en caja
  return db;
}

function addCustomer({ restaurantId, name, phone, birthMonth = null, birthDay = null, consent, door, waiterId = null, createdAt = new Date(), token }) {
  const c = {
    id: id('c'), restaurantId, name: name || null, phone, birthMonth, birthDay, consentAt: consent ? createdAt : null, optOut: false,
    cardToken: token || tok(), points: 0, stamps: 0, visits: 0, totalSpent: 0, firstVisitAt: null, lastVisitAt: null, joinedVia: door, waiterId, createdAt
  };
  db.customers.push(c);
  return c;
}

// ---------------------------------------------------------------- reglas (equivalentes a server/lib)
const rest = (rid) => db.restaurants.find((r) => r.id === rid);
const bogDayStart = (d = new Date()) => { const l = new Date(d.getTime() + BOG); l.setUTCHours(0, 0, 0, 0); return new Date(l.getTime() - BOG); };
const daysBetween = (a, b) => Math.floor((b - a) / DAY);
const firstName = (n) => (n || '').trim().split(/\s+/)[0] || 'Cliente';
const maskPhone = (e) => { const d = e.replace('+57', ''); return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`; };
const normalizePhone = (s) => { let d = String(s || '').replace(/\D/g, ''); if (d.length === 12 && d.startsWith('57')) d = d.slice(2); return d.length === 10 && d.startsWith('3') ? '+57' + d : null; };
const fail = (status, code, message) => { throw new ApiError(status, code, message); };

function weekIndex(date) {
  const l = new Date(new Date(date).getTime() + BOG);
  const day = (l.getUTCDay() + 6) % 7;
  return Math.round(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - day) / (7 * DAY));
}
function weeklyStreak(dates, now = new Date()) {
  const weeks = new Set(dates.map(weekIndex));
  const cur = weekIndex(now);
  const activeThisWeek = weeks.has(cur);
  let w = activeThisWeek ? cur : cur - 1, n = 0;
  while (weeks.has(w)) { n++; w--; }
  return { weeks: n, activeThisWeek };
}
function progress(ch, purchases, now = new Date()) {
  const inW = purchases.filter((p) => p.createdAt >= ch.startsAt && p.createdAt <= ch.endsAt);
  let value = 0;
  if (ch.kind === 'VISITS') value = inW.length;
  else if (ch.kind === 'SPEND') value = inW.reduce((s, p) => s + p.amount, 0);
  else value = weeklyStreak(inW.map((p) => p.createdAt), now).weeks;
  return { value, done: value >= ch.target };
}
const phonePurchases = (phone, f = () => true) => db.purchases.filter((p) => db.customers.find((c) => c.id === p.customerId)?.phone === phone && f(p));
const zoneRestaurantIds = (zid) => db.restaurants.filter((r) => r.zoneId === zid).map((r) => r.id);
const applicableChallenges = (r, now = new Date()) => db.challenges.filter((c) => c.active && c.startsAt <= now && c.endsAt >= now && (c.restaurantId === r.id || (!c.restaurantId && c.zoneId === r.zoneId)));
const applicableDraws = (r, now = new Date()) => db.draws.filter((d) => d.status === 'ACTIVE' && d.coljuegosAuthorization && d.startsAt <= now && d.endsAt >= now && (!d.zoneId || d.zoneId === r.zoneId));
const scopeFilter = (ch) => (p) => (ch.restaurantId ? p.restaurantId === ch.restaurantId : zoneRestaurantIds(ch.zoneId).includes(p.restaurantId));

function recordPurchase({ restaurant, customer, amount, door, validation, invoiceKey = null, invoiceNumber = null, at = new Date(), silent = false }) {
  const points = Math.floor(amount / 1000) * restaurant.pointsPerThousand;
  let stamps = customer.stamps + 1, reward = null;
  if (stamps >= restaurant.stampsGoal) {
    stamps = 0;
    reward = { id: id('rw'), restaurantId: restaurant.id, customerId: customer.id, kind: 'STAMP_CARD', description: restaurant.rewardText, status: 'AVAILABLE', expiresAt: new Date(at.getTime() + 60 * DAY), createdAt: at };
    db.rewards.push(reward);
  }
  const purchase = { id: id('p'), restaurantId: restaurant.id, customerId: customer.id, amount, door, validation, invoiceKey, invoiceNumber, createdAt: at };
  db.purchases.push(purchase);
  Object.assign(customer, { points: customer.points + points, stamps, visits: customer.visits + 1, totalSpent: customer.totalSpent + amount, lastVisitAt: at, firstVisitAt: customer.firstVisitAt || at });
  const extras = afterPurchase(restaurant, customer, purchase, at);
  return { purchase, points, reward, extras, silent };
}

function afterPurchase(r, customer, purchase, now) {
  const extras = { tickets: [], sticker: null, albumCompleted: null, challenges: [] };
  for (const d of applicableDraws(r, now)) {
    const number = db.tickets.filter((t) => t.drawId === d.id).length + 1;
    db.tickets.push({ id: id('tk'), drawId: d.id, number, purchaseId: purchase.id, customerId: customer.id, phone: customer.phone, restaurantId: r.id });
    extras.tickets.push({ drawName: d.name, prizeText: d.prizeText, number, drawAt: d.drawAt });
  }
  const zone = db.zones.find((z) => z.id === r.zoneId);
  if (zone && zone.seasonStart <= now && zone.seasonEnd >= now) {
    const ids = zoneRestaurantIds(zone.id);
    const inSeason = phonePurchases(customer.phone, (p) => ids.includes(p.restaurantId) && p.createdAt >= zone.seasonStart);
    const collected = new Set(inSeason.map((p) => p.restaurantId));
    extras.sticker = { isNew: inSeason.filter((p) => p.restaurantId === r.id).length === 1, collected: collected.size, total: ids.length, zoneName: zone.name, restaurantName: r.name };
    if (ids.every((x) => collected.has(x)) && !db.completions.find((c) => c.zoneId === zone.id && c.phone === customer.phone)) {
      db.rewards.push({ id: id('rw'), restaurantId: r.id, customerId: customer.id, kind: 'ALBUM', description: zone.rewardText, status: 'AVAILABLE', expiresAt: new Date(now.getTime() + 60 * DAY), createdAt: now });
      db.completions.push({ zoneId: zone.id, phone: customer.phone, restaurantId: r.id });
      extras.albumCompleted = { zoneName: zone.name, rewardText: zone.rewardText };
    }
  }
  for (const ch of applicableChallenges(r, now)) {
    if (db.challengeDone.find((x) => x.challengeId === ch.id && x.phone === customer.phone)) continue;
    if (!progress(ch, phonePurchases(customer.phone, scopeFilter(ch)), now).done) continue;
    db.challengeDone.push({ challengeId: ch.id, phone: customer.phone, customerId: customer.id });
    customer.points += ch.bonusPoints;
    extras.challenges.push({ title: ch.title, bonusPoints: ch.bonusPoints, sponsorName: ch.sponsorName });
  }
  return extras;
}

function award(r, customer, amount, door, validation, invoiceKey = null, invoiceNumber = null) {
  const today = db.purchases.filter((p) => p.customerId === customer.id && p.createdAt >= bogDayStart()).length;
  if (today >= r.maxClaimsPerDay) fail(429, 'daily_limit', `Ya sumaste ${today} compras hoy, el máximo del Club. Mañana puedes seguir sumando.`);
  if (invoiceKey && db.purchases.find((p) => p.restaurantId === r.id && p.invoiceKey === invoiceKey)) fail(409, 'invoice_used', 'Esta factura ya se usó para sumar puntos.');
  return recordPurchase({ restaurant: r, customer, amount, door, validation, invoiceKey, invoiceNumber });
}

function riskOf(c, now = new Date()) {
  if (!c.lastVisitAt) return null;
  const since = daysBetween(c.lastVisitAt, now);
  const avg = c.visits >= 2 ? Math.max(1, daysBetween(c.firstVisitAt, c.lastVisitAt) / (c.visits - 1)) : null;
  const threshold = avg ? Math.max(14, Math.round(avg * 2)) : 30;
  if (since < threshold) return null;
  const avgTicket = c.visits ? Math.round(c.totalSpent / c.visits) : 0;
  return { daysSince: since, avgTicket, level: c.visits >= 5 || avgTicket >= 100000 ? 'ALTO' : 'MEDIO' };
}
function daysToBirthday(c, now = new Date()) {
  if (!c.birthMonth) return null;
  const l = new Date(now.getTime() + BOG);
  const today = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
  let next = Date.UTC(l.getUTCFullYear(), c.birthMonth - 1, c.birthDay);
  if (next < today) next = Date.UTC(l.getUTCFullYear() + 1, c.birthMonth - 1, c.birthDay);
  return Math.round((next - today) / DAY);
}
function suggestionFor(c, r) {
  if (!c.visits) return 'Primera compra: al confirmarla, el cliente recibe su tarjeta del Club por WhatsApp.';
  const risk = riskOf(c), bday = daysToBirthday(c), toGoal = r.stampsGoal - c.stamps;
  if (bday !== null && bday <= 7) return `Cumple en ${bday === 0 ? 'hoy mismo' : bday + ' días'}: salúdalo y recuérdale su premio de cumpleaños.`;
  if (toGoal === 1) return `Le falta un sello para ganar: ${r.rewardText}. Cuéntale que con esta compra lo completa.`;
  if (risk) return `Llevaba ${risk.daysSince} días sin venir, más del doble de lo habitual. Dale una bienvenida especial.`;
  return `Cliente frecuente: ${c.visits} visitas. Le faltan ${toGoal} sellos para ${r.rewardText}.`;
}

const pubRest = (r) => ({ slug: r.slug, name: r.name, city: r.city, stampsGoal: r.stampsGoal, rewardText: r.rewardText, pointsPerThousand: r.pointsPerThousand, googleReviewUrl: r.googleReviewUrl });

function gamesView(c, r, now = new Date()) {
  const all = phonePurchases(c.phone);
  const challenges = applicableChallenges(r, now).map((ch) => {
    const pr = progress(ch, all.filter(scopeFilter(ch)), now);
    return { id: ch.id, title: ch.title, description: ch.description, kind: ch.kind, target: ch.target, value: Math.min(pr.value, ch.target), done: Boolean(db.challengeDone.find((x) => x.challengeId === ch.id && x.phone === c.phone)), bonusPoints: ch.bonusPoints, sponsorName: ch.sponsorName, endsAt: ch.endsAt, scope: ch.restaurantId ? 'RESTAURANT' : 'ZONE' };
  });
  const zone = db.zones.find((z) => z.id === r.zoneId);
  let album = null;
  if (zone) {
    const got = new Set(all.filter((p) => p.createdAt >= zone.seasonStart).map((p) => p.restaurantId));
    album = {
      zoneName: zone.name, rewardText: zone.rewardText, seasonEnd: zone.seasonEnd, active: true,
      completed: Boolean(db.completions.find((x) => x.zoneId === zone.id && x.phone === c.phone)),
      stickers: db.restaurants.filter((x) => x.zoneId === zone.id).map((x) => ({ name: x.name, slug: x.slug, collected: got.has(x.id), here: x.id === r.id }))
    };
  }
  const draws = applicableDraws(r, now).map((d) => {
    const mine = db.tickets.filter((t) => t.drawId === d.id && t.phone === c.phone).sort((a, b) => b.number - a.number);
    return { id: d.id, name: d.name, prizeText: d.prizeText, sponsorName: d.sponsorName, drawAt: d.drawAt, endsAt: d.endsAt, authorization: d.coljuegosAuthorization, termsUrl: d.termsUrl, ticketCount: mine.length, lastNumbers: mine.slice(0, 5).map((t) => t.number) };
  });
  return { streak: weeklyStreak(all.map((p) => p.createdAt), now), challenges, album, draws };
}

function cardView(c) {
  const r = rest(c.restaurantId);
  const now = new Date();
  return {
    token: c.cardToken, name: c.name, phoneLast4: c.phone.slice(-4), points: c.points, stamps: c.stamps, visits: c.visits, needsConsent: !c.consentAt,
    rewards: db.rewards.filter((x) => x.customerId === c.id && x.status === 'AVAILABLE' && (!x.expiresAt || x.expiresAt > now)).map((x) => ({ id: x.id, kind: x.kind, description: x.description, expiresAt: x.expiresAt })),
    googleWalletUrl: null, games: gamesView(c, r), restaurant: pubRest(r)
  };
}

function profile(c, r) {
  const risk = riskOf(c), bday = daysToBirthday(c);
  return {
    id: c.id, name: c.name, phone: maskPhone(c.phone), visits: c.visits, points: c.points, stamps: c.stamps, stampsGoal: r.stampsGoal,
    avgTicket: c.visits ? Math.round(c.totalSpent / c.visits) : 0, lastVisitAt: c.lastVisitAt, hasConsent: Boolean(c.consentAt),
    tags: [risk ? `${risk.daysSince} días sin venir` : null, bday !== null && bday <= 30 ? (bday === 0 ? 'Cumple hoy' : `Cumple en ${bday} días`) : null].filter(Boolean),
    suggestion: suggestionFor(c, r),
    rewards: db.rewards.filter((x) => x.customerId === c.id && x.status === 'AVAILABLE').map((x) => ({ id: x.id, kind: x.kind, description: x.description, expiresAt: x.expiresAt }))
  };
}

const byToken = (t) => db.customers.find((c) => c.cardToken === t) || fail(404, 'card_not_found', 'No encontramos esta tarjeta.');
const bySlug = (s) => db.restaurants.find((r) => r.slug === s) || fail(404, 'restaurant_not_found', 'No encontramos este restaurante.');

// ---------------------------------------------------------------- rutas
const routes = [
  ['POST', /^\/auth\/login$/, (b) => {
    const email = String(b.email || '').toLowerCase();
    if (!email) fail(400, 'invalid_input', 'Escribe tu correo.');
    const role = email.startsWith('caja') ? 'CASHIER' : 'OWNER';
    return { token: 'demo', staff: { name: role === 'OWNER' ? 'Administrador demo' : 'Caja demo', role }, restaurant: pubRest(db.restaurants[0]) };
  }],
  ['GET', /^\/r\/([^/?]+)(?:\?(.*))?$/, (b, m) => {
    const r = bySlug(m[1]);
    const t = new URLSearchParams(m[2] || '').get('t');
    const tag = db.tags.find((x) => x.restaurantId === r.id && x.code === t);
    return { restaurant: pubRest(r), tag: tag ? { code: tag.code, label: tag.label } : null };
  }],
  ['POST', /^\/r\/([^/]+)\/entry$/, () => ({ ok: true })],
  ['POST', /^\/r\/([^/]+)\/join$/, (b, m) => {
    const r = bySlug(m[1]);
    if (!b.name || b.name.trim().length < 2) fail(400, 'invalid_input', 'Escribe tu nombre.');
    const phone = normalizePhone(b.phone) || fail(400, 'invalid_phone', 'Escribe un celular colombiano de 10 dígitos, por ejemplo 300 555 1234.');
    const exists = db.customers.find((c) => c.restaurantId === r.id && c.phone === phone);
    if (exists) return { status: 'link_sent', devToken: exists.cardToken };
    const [bm, bd] = b.birthday ? b.birthday.split('-').map(Number) : [null, null];
    const waiter = db.waiters.find((w) => w.restaurantId === r.id && w.code === String(b.waiter || '').toUpperCase() && w.active);
    const c = addCustomer({ restaurantId: r.id, name: b.name.trim(), phone, birthMonth: bm, birthDay: bd, consent: true, door: b.door, waiterId: waiter?.id || null });
    return { status: 'created', token: c.cardToken };
  }],
  ['POST', /^\/r\/([^/]+)\/card-link$/, (b, m) => {
    const r = bySlug(m[1]);
    const phone = normalizePhone(b.phone) || fail(400, 'invalid_phone', 'Escribe un celular colombiano de 10 dígitos.');
    const c = db.customers.find((x) => x.restaurantId === r.id && x.phone === phone) || fail(404, 'not_member', 'Ese número todavía no está en el Club. Únete con tus datos, toma menos de un minuto.');
    return { status: 'link_sent', devToken: c.cardToken };
  }],
  ['GET', /^\/c\/([^/]+)$/, (b, m) => { const c = byToken(m[1]); lastRestaurantId = c.restaurantId; return cardView(c); }],
  ['POST', /^\/c\/([^/]+)\/consent$/, (b, m) => { const c = byToken(m[1]); c.consentAt = c.consentAt || new Date(); c.optOut = false; return cardView(c); }],
  ['POST', /^\/c\/([^/]+)\/optout$/, (b, m) => { byToken(m[1]).optOut = true; return { ok: true }; }],
  ['POST', /^\/c\/([^/]+)\/invoice$/, (b, m) => {
    const c = byToken(m[1]); const r = rest(c.restaurantId);
    const total = Number((String(b.qr).match(/ValTolFac:\s*([\d.]+)/) || [])[1]) || 0;
    const nit = (String(b.qr).match(/NitFac:\s*(\d+)/) || [])[1];
    const key = (String(b.qr).match(/CUFE:\s*([0-9a-f]+)/i) || [])[1];
    if (!key) fail(422, 'invoice_unreadable', 'No reconocimos este código como una factura electrónica.');
    if (!total) fail(422, 'invoice_no_amount', 'Esta factura no trae el valor en su código. Pide en caja que confirmen tu compra con tu número.');
    if (nit && nit !== r.nit) fail(422, 'invoice_other_business', `Esta factura no es de ${r.name}.`);
    const res = award(r, c, Math.round(total), ['NFC', 'QR', 'WHATSAPP', 'WALLET'].includes(b.door) ? b.door : 'QR', 'INVOICE', key, (String(b.qr).match(/NumFac:\s*(\S+)/) || [])[1]);
    return { ok: true, amount: Math.round(total), invoiceNumber: res.purchase.invoiceNumber, pointsAwarded: res.points, rewardUnlocked: res.reward ? { description: res.reward.description } : null, extras: res.extras, card: cardView(c) };
  }],
  ['POST', /^\/c\/([^/]+)\/code$/, (b, m) => {
    const c = byToken(m[1]); const r = rest(c.restaurantId);
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    let dc = db.deliveryCodes.find((x) => x.code === code);
    if (!dc && code === 'AB48K2') dc = { code, amount: 54900, usedAt: null }; // código de ejemplo impreso en el empaque
    if (!dc) fail(404, 'code_not_found', 'Este código no existe. Prueba con AB48K2, el código de ejemplo.');
    if (dc.usedAt) fail(409, 'code_used', 'Este código ya se usó.');
    const res = award(r, c, dc.amount, 'DELIVERY_CODE', 'DELIVERY_CODE');
    dc.usedAt = new Date(); if (!db.deliveryCodes.includes(dc)) db.deliveryCodes.push(dc);
    return { ok: true, amount: dc.amount, pointsAwarded: res.points, rewardUnlocked: res.reward ? { description: res.reward.description } : null, extras: res.extras, card: cardView(c) };
  }],
  ['POST', /^\/c\/([^/]+)\/feedback$/, (b, m) => {
    const c = byToken(m[1]);
    db.feedback.unshift({ id: id('f'), restaurantId: c.restaurantId, customerId: c.id, rating: b.rating, comment: b.comment || null, createdAt: new Date(), handledAt: null });
    return { ok: true, googleReviewUrl: rest(c.restaurantId).googleReviewUrl };
  }],
  // Caja
  ['GET', /^\/staff\/customers\/lookup\?(.*)$/, (b, m) => {
    const q = new URLSearchParams(m[1]); const r = db.restaurants[0];
    if (q.get('phone')) {
      const phone = normalizePhone(q.get('phone')) || fail(400, 'invalid_phone', 'Escribe los 10 dígitos del celular.');
      const c = db.customers.find((x) => x.restaurantId === r.id && x.phone === phone);
      return c ? { found: true, customer: profile(c, r) } : { found: false, phone: maskPhone(phone) };
    }
    const c = db.customers.find((x) => x.cardToken === q.get('card') && x.restaurantId === r.id) || fail(404, 'card_not_found', 'Este pase no pertenece al Club de este restaurante.');
    return { found: true, customer: profile(c, r) };
  }],
  ['POST', /^\/staff\/purchases$/, (b) => {
    const r = db.restaurants[0]; let c, created = false;
    if (b.customerId) c = db.customers.find((x) => x.id === b.customerId);
    else {
      const phone = normalizePhone(b.phone) || fail(400, 'invalid_phone', 'Escribe los 10 dígitos del celular.');
      c = db.customers.find((x) => x.restaurantId === r.id && x.phone === phone);
      if (!c) { c = addCustomer({ restaurantId: r.id, phone, consent: false, door: 'CASHIER' }); created = true; }
    }
    const res = award(r, c, b.amount, b.door || 'CASHIER', 'CASHIER');
    return { ok: true, newCustomer: created, pointsAwarded: res.points, rewardUnlocked: res.reward ? { description: res.reward.description } : null, extras: res.extras, customer: profile(c, r) };
  }],
  ['POST', /^\/staff\/rewards\/([^/]+)\/redeem$/, (b, m) => {
    const rw = db.rewards.find((x) => x.id === m[1]) || fail(404, 'reward_not_found', 'Premio no encontrado.');
    if (rw.status !== 'AVAILABLE') fail(409, 'reward_used', 'Este premio ya fue canjeado.');
    rw.status = 'REDEEMED'; rw.redeemedAt = new Date(); return { ok: true };
  }],
  ['POST', /^\/staff\/delivery-codes$/, (b) => {
    const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const dc = { code, amount: b.amount, usedAt: null, expiresAt: new Date(Date.now() + 7 * DAY) };
    db.deliveryCodes.push(dc); return dc;
  }],
  // Panel
  ['GET', /^\/panel\/summary/, () => {
    const r = db.restaurants[0], from = new Date(Date.now() - 30 * DAY);
    const ps = db.purchases.filter((p) => p.restaurantId === r.id && p.createdAt >= from);
    const active = new Set(ps.map((p) => p.customerId));
    const cs = db.customers.filter((c) => c.restaurantId === r.id);
    const risk = cs.map((c) => riskOf(c)).filter(Boolean);
    const sales = ps.reduce((s, p) => s + p.amount, 0);
    return { days: 30, restaurant: pubRest(r), enrolled: cs.length, newMembers: cs.filter((c) => c.createdAt >= from).length, validatedSales: sales, purchases: ps.length, activeMembers: active.size, visitsPerActive: active.size ? +(ps.length / active.size).toFixed(1) : 0, avgTicket: ps.length ? Math.round(sales / ps.length) : 0, rewardsRedeemed: db.rewards.filter((x) => x.restaurantId === r.id && x.status === 'REDEEMED').length, atRisk: risk.length, atRiskHigh: risk.filter((x) => x.level === 'ALTO').length };
  }],
  ['GET', /^\/panel\/doors/, () => {
    const from = new Date(Date.now() - 30 * DAY);
    const ps = db.purchases.filter((p) => p.restaurantId === 'r1' && p.createdAt >= from);
    return { days: 30, doors: ['NFC', 'QR', 'WHATSAPP', 'WALLET', 'CASHIER', 'DELIVERY_CODE'].map((door) => ({ door, purchases: ps.filter((p) => p.door === door).length, sales: 0, entries: 0 })) };
  }],
  ['GET', /^\/panel\/at-risk$/, () => ({
    customers: db.customers.filter((c) => c.restaurantId === 'r1').map((c) => ({ c, risk: riskOf(c) })).filter((x) => x.risk).sort((a, b) => b.c.totalSpent - a.c.totalSpent)
      .map(({ c, risk }) => ({ id: c.id, name: c.name || 'Sin nombre', phone: maskPhone(c.phone), visits: c.visits, avgTicket: risk.avgTicket, daysSince: risk.daysSince, level: risk.level, canMessage: Boolean(c.consentAt) && !c.optOut, lastInvitedAt: db.messages.find((x) => x.customerId === c.id)?.at || null }))
  })],
  ['POST', /^\/panel\/customers\/([^/]+)\/invite$/, (b, m) => { db.messages.push({ customerId: m[1], at: new Date().toISOString() }); return { ok: true }; }],
  ['GET', /^\/panel\/automations$/, () => ({
    automations: [
      ['WELCOME', 'Bienvenida', 'Al inscribirse: enlace a su tarjeta del Club'], ['WINBACK', 'Te extrañamos', 'Cuando un cliente lleva más del doble de su frecuencia sin volver'],
      ['BIRTHDAY', 'Cumpleaños', '5 días antes, con un premio que vence a los 10 días'], ['NEAR_REWARD', 'Premio casi listo', 'Cuando le falta un sello para completar la tarjeta'],
      ['LOW_RATING', 'Alerta de calificación baja', 'Aviso al administrador con 1 a 3 estrellas']
    ].map(([key, title, detail]) => ({ key, title, detail, enabled: db.automations[key] }))
  })],
  ['PUT', /^\/panel\/automations\/([A-Z_]+)$/, (b, m) => { db.automations[m[1]] = b.enabled; return { ok: true }; }],
  ['GET', /^\/panel\/feedback$/, () => {
    const recent = db.feedback.filter((f) => f.restaurantId === 'r1');
    const avg = recent.length ? recent.reduce((s, f) => s + f.rating, 0) / recent.length : null;
    return { average30d: avg ? +avg.toFixed(1) : null, count30d: recent.length, items: recent.map((f) => { const c = db.customers.find((x) => x.id === f.customerId); return { ...f, customer: c ? { name: c.name, phone: maskPhone(c.phone) } : null, daysAgo: daysBetween(f.createdAt, new Date()) }; }) };
  }],
  ['POST', /^\/panel\/feedback\/([^/]+)\/handled$/, (b, m) => { const f = db.feedback.find((x) => x.id === m[1]); if (f) f.handledAt = new Date(); return { ok: true }; }],
  ['GET', /^\/panel\/settings$/, () => ({ settings: db.restaurants[0] })],
  ['PUT', /^\/panel\/settings$/, (b) => { Object.assign(db.restaurants[0], b); return { settings: db.restaurants[0] }; }],
  ['GET', /^\/panel\/tags$/, () => ({ tags: db.tags.map((t) => ({ ...t, nfcUrl: `https://facil.onrender.com/r/arepa-y-brasa?t=${t.code}&via=nfc`, qrUrl: `https://facil.onrender.com/r/arepa-y-brasa?t=${t.code}&via=qr` })) })],
  ['POST', /^\/panel\/tags$/, (b) => {
    if (db.tags.find((t) => t.code === String(b.code).toUpperCase())) fail(409, 'tag_exists', 'Ya existe una pieza con ese código.');
    const t = { id: id('t'), restaurantId: 'r1', code: String(b.code).toUpperCase(), label: b.label, active: true }; db.tags.push(t); return { tag: t };
  }],
  ['GET', /^\/panel\/games$/, () => {
    const from = new Date(Date.now() - 30 * DAY);
    const ranking = db.waiters.filter((w) => w.restaurantId === 'r1').map((w) => {
      const cs = db.customers.filter((c) => c.waiterId === w.id);
      return { id: w.id, name: w.name, code: w.code, active: w.active, enrolled30d: cs.filter((c) => c.createdAt >= from).length + (w.code === 'LUIS' ? 9 : w.code === 'ANDREA' ? 6 : 2), returned: cs.filter((c) => c.visits >= 2).length, enrolledTotal: cs.length, sales: cs.reduce((s, c) => s + c.totalSpent, 0), qrUrl: `https://facil.onrender.com/r/arepa-y-brasa?via=qr&m=${w.code}` };
    }).sort((a, b) => b.enrolled30d - a.enrolled30d || b.returned - a.returned);
    const zone = db.zones[0];
    return {
      ranking,
      challenges: db.challenges.filter((c) => c.restaurantId === 'r1' || c.zoneId === 'z1').map((c) => ({ ...c, scope: c.restaurantId ? 'RESTAURANT' : 'ZONE', editable: c.restaurantId === 'r1', completions: db.challengeDone.filter((x) => x.challengeId === c.id).length })),
      zone: { name: zone.name, rewardText: zone.rewardText, seasonStart: zone.seasonStart, seasonEnd: zone.seasonEnd, restaurants: db.restaurants.filter((r) => r.zoneId === zone.id).map((r) => r.name), completions: db.completions.length, completedHere: db.completions.filter((x) => x.restaurantId === 'r1').length },
      draws: db.draws.map((d) => ({ ...d, authorization: d.coljuegosAuthorization, ticketsTotal: db.tickets.filter((t) => t.drawId === d.id).length, ticketsHere: db.tickets.filter((t) => t.drawId === d.id && t.restaurantId === 'r1').length }))
    };
  }],
  ['POST', /^\/panel\/waiters$/, (b) => {
    const code = String(b.code || '').toUpperCase();
    if (!/^[A-Z0-9]{2,12}$/.test(code)) fail(400, 'invalid_input', 'El código debe tener de 2 a 12 letras o números, sin espacios.');
    if (db.waiters.find((w) => w.code === code)) fail(409, 'waiter_exists', 'Ya hay un mesero con ese código.');
    const w = { id: id('w'), restaurantId: 'r1', name: b.name, code, active: true }; db.waiters.push(w); return { waiter: w };
  }],
  ['PUT', /^\/panel\/waiters\/([^/]+)$/, (b, m) => { const w = db.waiters.find((x) => x.id === m[1]); w.active = b.active; return { waiter: w }; }],
  ['POST', /^\/panel\/challenges$/, (b) => {
    const c = { id: id('ch'), restaurantId: 'r1', zoneId: null, title: b.title, description: b.description || null, kind: b.kind, target: b.target, bonusPoints: b.bonusPoints, sponsorName: null, startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt), active: true };
    if (c.endsAt <= c.startsAt) fail(400, 'invalid_input', 'La fecha de cierre debe ser posterior a la de inicio.');
    db.challenges.push(c); return { challenge: c };
  }],
  ['PUT', /^\/panel\/challenges\/([^/]+)$/, (b, m) => { const c = db.challenges.find((x) => x.id === m[1]); c.active = b.active; return { challenge: c }; }]
];

// Las respuestas pasan por JSON para que las fechas lleguen como texto, igual que desde el servidor real.
export async function api(path, { method = 'GET', body } = {}) {
  if (!db) resetDemo();
  await new Promise((r) => setTimeout(r, 220));
  for (const [m, re, fn] of routes) {
    if (m !== method) continue;
    const match = path.match(re);
    if (match) return JSON.parse(JSON.stringify(fn(body || {}, match)));
  }
  throw new ApiError(404, 'not_found', 'Ruta no disponible en la versión de revisión.');
}

export function demoInvoiceQr() {
  if (!db) resetDemo();
  const r = rest(lastRestaurantId) || db.restaurants[0];
  const l = new Date(Date.now() + BOG).toISOString();
  const total = [52000, 86400, 64900, 38500][Math.floor(Math.random() * 4)];
  const key = Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  return `NumFac: FE-${Math.floor(Math.random() * 90000) + 10000} FecFac: ${l.slice(0, 10)} HorFac: ${l.slice(11, 19)}-05:00 NitFac: ${r.nit} ValTolFac: ${total}.00 CUFE: ${key}`;
}

export function demoCustomerToken(slug) {
  if (!db) resetDemo();
  const r = db.restaurants.find((x) => x.slug === slug);
  return db.customers.find((c) => c.restaurantId === r.id && c.phone === '+573005551234')?.cardToken;
}

export function clearDemoStorage() {
  for (const s of ['arepa-y-brasa', 'cafe-del-prado', 'la-esquina']) store.del(cardKey(s));
  store.del(STAFF_KEY);
}

// Sesión de ejemplo para entrar directo a la caja o al panel sin pedir correo ni contraseña.
export function demoSession(role) {
  if (!db) resetDemo();
  return { token: 'demo', staff: { name: role === 'OWNER' ? 'Administrador demo' : 'Caja demo', role }, restaurant: pubRest(db.restaurants[0]) };
}
