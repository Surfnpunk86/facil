// Lecturas del comportamiento de cada cliente: frecuencia, riesgo de abandono y sugerencia para el equipo.
import { daysBetween, bogotaMonthDay } from './util.js';

// Días promedio entre visitas; null si tiene menos de 2 visitas.
export function avgInterval(c) {
  if (!c.firstVisitAt || !c.lastVisitAt || c.visits < 2) return null;
  return Math.max(1, daysBetween(c.firstVisitAt, c.lastVisitAt) / (c.visits - 1));
}

// En riesgo: lleva más del doble de su frecuencia sin volver (mínimo 14 días),
// o, si solo vino una vez, más de 30 días.
export function riskOf(c, now = new Date()) {
  if (!c.lastVisitAt) return null;
  const since = daysBetween(c.lastVisitAt, now);
  const avg = avgInterval(c);
  const threshold = avg ? Math.max(14, Math.round(avg * 2)) : 30;
  if (since < threshold) return null;
  const avgTicket = c.visits ? Math.round(c.totalSpent / c.visits) : 0;
  const level = c.visits >= 5 || avgTicket >= 100000 ? 'ALTO' : 'MEDIO';
  return { daysSince: since, threshold, avgTicket, level };
}

export function daysToBirthday(c, now = new Date()) {
  if (!c.birthMonth || !c.birthDay) return null;
  const { year, month, day } = bogotaMonthDay(now);
  const today = Date.UTC(year, month - 1, day);
  let next = Date.UTC(year, c.birthMonth - 1, c.birthDay);
  if (next < today) next = Date.UTC(year + 1, c.birthMonth - 1, c.birthDay);
  return Math.round((next - today) / 86400000);
}

// Frase corta que ve el cajero al identificar al cliente.
export function suggestionFor(c, restaurant, now = new Date()) {
  if (!c.visits) return 'Primera compra: al confirmarla, el cliente recibe su tarjeta del Club por WhatsApp.';
  const risk = riskOf(c, now);
  const bday = daysToBirthday(c, now);
  const toGoal = restaurant.stampsGoal - c.stamps;
  if (bday !== null && bday <= 7) return `Cumple en ${bday === 0 ? 'hoy mismo' : bday + ' días'}: salúdalo y recuérdale su premio de cumpleaños.`;
  if (toGoal === 1) return `Le falta un sello para ganar: ${restaurant.rewardText}. Cuéntale que con esta compra lo completa.`;
  if (risk) return `Llevaba ${risk.daysSince} días sin venir, más del doble de lo habitual. Dale una bienvenida especial.`;
  return `Cliente frecuente: ${c.visits} visitas. Le faltan ${toGoal} sellos para ${restaurant.rewardText}.`;
}
