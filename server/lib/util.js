// Utilidades compartidas: teléfonos colombianos, errores HTTP y fechas en hora de Bogotá.

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Normaliza un celular colombiano a E.164 (+57XXXXXXXXXX). Devuelve null si no es válido.
export function normalizePhone(input) {
  if (!input) return null;
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('0057')) d = d.slice(4);
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  if (d.length !== 10 || !d.startsWith('3')) return null;
  return '+57' + d;
}

export function maskPhone(e164) {
  if (!e164) return '';
  const d = e164.replace('+57', '');
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000; // Colombia no tiene horario de verano

// Inicio del día actual en Bogotá, como Date UTC.
export function startOfBogotaDay(now = new Date()) {
  const local = new Date(now.getTime() + BOGOTA_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - BOGOTA_OFFSET_MS);
}

// Mes y día actuales en Bogotá.
export function bogotaMonthDay(date = new Date()) {
  const local = new Date(date.getTime() + BOGOTA_OFFSET_MS);
  return { month: local.getUTCMonth() + 1, day: local.getUTCDate(), year: local.getUTCFullYear() };
}

export const daysBetween = (a, b) => Math.floor((b.getTime() - a.getTime()) / 86400000);

export function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || 'Hola';
}

export function randomCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para leerlo fácil
  let out = '';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function randomToken(bytes = 18) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
}
