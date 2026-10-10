import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekIndex, weeklyStreak, challengeProgress } from '../server/lib/games.js';

// Fechas de referencia en hora de Bogotá: el lunes 5 de octubre de 2026 empieza una semana.
const bog = (s) => new Date(`${s}-05:00`);

test('la semana empieza el lunes en hora de Bogotá', () => {
  assert.equal(weekIndex(bog('2026-10-05T00:30:00')), weekIndex(bog('2026-10-11T23:50:00')));
  assert.notEqual(weekIndex(bog('2026-10-04T23:50:00')), weekIndex(bog('2026-10-05T00:10:00')));
});

test('racha de semanas seguidas, viva aunque esta semana no haya compra', () => {
  const now = bog('2026-10-07T12:00:00');
  const dates = [bog('2026-09-22T13:00:00'), bog('2026-09-29T20:00:00'), bog('2026-10-02T19:00:00')];
  assert.deepEqual(weeklyStreak(dates, now), { weeks: 2, activeThisWeek: false });
  assert.deepEqual(weeklyStreak([...dates, bog('2026-10-06T13:00:00')], now), { weeks: 3, activeThisWeek: true });
});

test('una semana sin compra rompe la racha', () => {
  const now = bog('2026-10-07T12:00:00');
  const dates = [bog('2026-09-15T13:00:00'), bog('2026-10-06T13:00:00')];
  assert.equal(weeklyStreak(dates, now).weeks, 1);
});

test('progreso de retos por visitas, gasto y racha dentro de la ventana', () => {
  const now = bog('2026-10-20T12:00:00');
  const base = { startsAt: bog('2026-10-01T00:00:00'), endsAt: bog('2026-10-31T23:59:59') };
  const purchases = [
    { createdAt: bog('2026-09-30T12:00:00'), amount: 90000 }, // fuera de la ventana
    { createdAt: bog('2026-10-06T12:00:00'), amount: 40000 },
    { createdAt: bog('2026-10-13T12:00:00'), amount: 55000 },
    { createdAt: bog('2026-10-19T12:00:00'), amount: 30000 }
  ];
  assert.deepEqual(challengeProgress({ ...base, kind: 'VISITS', target: 3 }, purchases, now), { value: 3, target: 3, done: true });
  assert.equal(challengeProgress({ ...base, kind: 'SPEND', target: 150000 }, purchases, now).value, 125000);
  assert.equal(challengeProgress({ ...base, kind: 'STREAK_WEEKS', target: 3 }, purchases, now).done, true);
});
