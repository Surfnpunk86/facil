import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInvoiceQr, nitMatches, parseMoney, invoiceDate } from '../server/lib/dian.js';
import { normalizePhone } from '../server/lib/util.js';
import { riskOf, daysToBirthday } from '../server/lib/insights.js';

const CUFE = '941cf36af62dbbc06f105d2a80e9bfe683a90e84960eae4d351cc3afbe8f848c26c39bac4fbc80fa254824c6369ea694';

test('lee el QR multilínea de una factura electrónica', () => {
  const qr = `NumFac: FE18842
FecFac: 2026-09-25
HorFac: 20:41:00-05:00
NitFac: 901234567
DocAdq: 1045678901
ValFac: 72605.00
ValIva: 13795.00
ValOtroIm: 0.00
ValTolFac: 86400.00
CUFE: ${CUFE}
QRCode: https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${CUFE}`;
  const p = parseInvoiceQr(qr);
  assert.equal(p.number, 'FE18842');
  assert.equal(p.nit, '901234567');
  assert.equal(p.total, 86400);
  assert.equal(p.key, CUFE);
  assert.equal(invoiceDate(p).toISOString(), '2026-09-26T01:41:00.000Z');
});

test('lee el QR en una sola línea y con CUDE', () => {
  const p = parseInvoiceQr(`NumFac:POS-99 FecFac:2026-09-25 NitFac:9012345678 ValTolFac:54900.00 CUDE:${CUFE.toUpperCase()}`);
  assert.equal(p.total, 54900);
  assert.equal(p.key, CUFE);
  assert.ok(nitMatches(p.nit, '901234567'), 'acepta NIT con dígito de verificación');
});

test('QR que solo trae la URL: hay llave pero no monto', () => {
  const p = parseInvoiceQr(`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${CUFE}`);
  assert.equal(p.key, CUFE);
  assert.equal(p.total, null);
});

test('texto que no es factura', () => {
  const p = parseInvoiceQr('https://instagram.com/arepaybrasa');
  assert.equal(p.key, null);
});

test('montos en formato DIAN y colombiano', () => {
  assert.equal(parseMoney('86400.00'), 86400);
  assert.equal(parseMoney('1.785.000,00'), 1785000);
  assert.equal(parseMoney('$ 54.900,5'), 54901);
});

test('NIT de otro negocio no coincide', () => {
  assert.equal(nitMatches('800199436', '901234567'), false);
});

test('normaliza celulares colombianos', () => {
  assert.equal(normalizePhone('300 555 1234'), '+573005551234');
  assert.equal(normalizePhone('+57 300-555-1234'), '+573005551234');
  assert.equal(normalizePhone('573005551234'), '+573005551234');
  assert.equal(normalizePhone('6053334455'), null, 'fijo no es celular');
  assert.equal(normalizePhone('12345'), null);
});

test('riesgo de abandono según la frecuencia propia', () => {
  const now = new Date('2026-09-25T15:00:00Z');
  const regular = { visits: 8, totalSpent: 800000, firstVisitAt: new Date('2026-06-01'), lastVisitAt: new Date('2026-08-20') };
  const r = riskOf(regular, now);
  assert.ok(r, 'cada ~11 días y lleva 36 sin venir: en riesgo');
  assert.equal(r.level, 'ALTO');
  const recent = { ...regular, lastVisitAt: new Date('2026-09-20') };
  assert.equal(riskOf(recent, now), null);
});

test('días para el cumpleaños con cambio de año', () => {
  const now = new Date('2026-12-30T15:00:00Z');
  assert.equal(daysToBirthday({ birthMonth: 1, birthDay: 2 }, now), 3);
  assert.equal(daysToBirthday({ birthMonth: 12, birthDay: 30 }, now), 0);
});
