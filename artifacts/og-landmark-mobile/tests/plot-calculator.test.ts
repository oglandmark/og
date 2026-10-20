import assert from 'node:assert/strict';
import test from 'node:test';
import { computePlotArea } from '../lib/plotCalculator';

test('valid triangle measurements return an exact area', () => {
  const result = computePlotArea(3, { A: '3', B: '4', C: '5' }, 'ft', 'accurate');

  assert.equal(typeof result, 'object');
  if (typeof result === 'string') return;
  assert.equal(result.sqft, 6);
  assert.equal(result.isEstimate, false);
});

test('accurate quadrilateral triangulation uses the measured diagonal', () => {
  const diagonal = String(Math.hypot(100, 60));
  const result = computePlotArea(
    4,
    { A: '100', B: '60', C: '100', D: '60', AC: diagonal },
    'ft',
    'accurate',
  );

  assert.equal(typeof result, 'object');
  if (typeof result === 'string') return;
  assert.ok(Math.abs(result.sqft - 6000) < 1e-8);
  assert.equal(result.isEstimate, false);
  assert.match(result.note ?? '', /Accurate triangulation/);
});

test('accurate mode requires the diagonal for an irregular four-sided plot', () => {
  const result = computePlotArea(4, { A: '100', B: '60', C: '100', D: '60' }, 'ft', 'accurate');

  assert.equal(typeof result, 'string');
  if (typeof result !== 'string') return;
  assert.match(result, /Diagonal A–C/);
});

test('basic four-side mode remains explicitly approximate', () => {
  const result = computePlotArea(4, { A: '100', B: '60', C: '100', D: '60' }, 'ft', 'basic');

  assert.equal(typeof result, 'object');
  if (typeof result === 'string') return;
  assert.equal(result.isEstimate, true);
  assert.match(result.note ?? '', /Basic estimate/);
});

test('degenerate triangle sides are never labeled exact', () => {
  const result = computePlotArea(3, { A: '1', B: '2', C: '3' }, 'ft', 'accurate');

  assert.equal(typeof result, 'object');
  if (typeof result === 'string') return;
  assert.equal(result.isEstimate, true);
  assert.match(result.note ?? '', /Approximate estimate/);
});
