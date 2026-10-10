// Lectura del QR de la factura electrónica DIAN (y del documento equivalente POS electrónico).
//
// El QR de la representación gráfica trae, según el anexo técnico de facturación electrónica,
// pares "Clave: valor" como:
//   NumFac: SETP990000002  FecFac: 2026-09-25  HorFac: 20:41:00-05:00
//   NitFac: 901234567      DocAdq: 1045678901   ValFac: 72605.00
//   ValIva: 13795.00       ValOtroIm: 0.00      ValTolFac: 86400.00
//   CUFE: 941cf36a...      QRCode: https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=941cf36a...
// Algunos proveedores solo imprimen la URL de consulta; en ese caso no hay monto y la compra
// debe confirmarse en caja. PENDIENTE: validar con facturas reales de los locales piloto.

const MONEY_KEYS = ['valtolfac', 'valtotfac', 'valtotal', 'valtot', 'total'];
const KEY_KEYS = ['cufe', 'cude', 'cuds'];

export function parseMoney(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[$\s]/g, '');
  if (!s) return null;
  // "1.785.000,00" → formato colombiano; "1785000.00" → formato DIAN
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseInvoiceQr(text) {
  const out = { number: null, date: null, time: null, nit: null, buyerDoc: null, total: null, key: null, url: null, raw: text };
  if (!text || typeof text !== 'string') return out;
  const src = text.trim();

  const pairs = {};
  const re = /([A-Za-z]{3,12})\s*[:=]\s*(\S+)/g;
  let m;
  while ((m = re.exec(src))) {
    const k = m[1].toLowerCase();
    if (!(k in pairs)) pairs[k] = m[2];
  }

  const urlMatch = src.match(/https?:\/\/\S+/);
  if (urlMatch) out.url = urlMatch[0];

  out.number = pairs.numfac || pairs.numds || pairs.numdoceq || pairs.numpos || firstKeyStarting(pairs, 'num');
  out.date = pairs.fecfac || firstKeyStarting(pairs, 'fec');
  out.time = pairs.horfac || firstKeyStarting(pairs, 'hor');
  out.nit = onlyDigits(pairs.nitfac || firstKeyStarting(pairs, 'nit')) || null;
  out.buyerDoc = pairs.docadq || null;

  for (const k of MONEY_KEYS) {
    if (pairs[k] != null) { out.total = parseMoney(pairs[k]); break; }
  }

  for (const k of KEY_KEYS) {
    if (pairs[k] && /^[0-9a-f]{20,}$/i.test(pairs[k])) { out.key = pairs[k].toLowerCase(); break; }
  }
  if (!out.key && out.url) {
    const dk = out.url.match(/documentkey=([0-9a-f]{20,})/i);
    if (dk) out.key = dk[1].toLowerCase();
  }
  return out;
}

function firstKeyStarting(pairs, prefix) {
  const k = Object.keys(pairs).find((x) => x.startsWith(prefix));
  return k ? pairs[k] : null;
}

function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

// Compara NIT sin dígito de verificación: el emisor puede venir con o sin él.
export function nitMatches(invoiceNit, restaurantNit) {
  const a = onlyDigits(invoiceNit);
  const b = onlyDigits(restaurantNit);
  if (!a || !b) return false;
  return a === b || a.slice(0, -1) === b || b.slice(0, -1) === a;
}

// Fecha y hora de la factura como Date (hora de Colombia si no trae zona).
export function invoiceDate(parsed) {
  if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return null;
  let time = parsed.time && /^\d{2}:\d{2}(:\d{2})?/.test(parsed.time) ? parsed.time : '12:00:00';
  if (!/[+-]\d{2}:\d{2}$|Z$/.test(time)) time += '-05:00';
  const d = new Date(`${parsed.date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d;
}
