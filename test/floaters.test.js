// test/floaters.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFloaters, addFloater, updateFloaters } from '../src/floaters.js';

test('createFloaters starts empty', () => {
  const f = createFloaters();
  assert.deepEqual(f.list, []);
});

test('addFloater pushes a floater with position, text and kind', () => {
  const f = createFloaters();
  addFloater(f, 10, 20, '5', 'dmg');
  assert.equal(f.list.length, 1);
  const fl = f.list[0];
  assert.equal(fl.x, 10);
  assert.equal(fl.y, 20);
  assert.equal(fl.text, '5');
  assert.equal(fl.kind, 'dmg');
});

test('floaters drift up 30px/s and age', () => {
  const f = createFloaters();
  addFloater(f, 0, 100, '1', 'dmg');
  updateFloaters(f, 0.5);
  assert.equal(f.list.length, 1);
  assert.ok(Math.abs(f.list[0].y - 85) < 1e-9); // rose 15px
  assert.ok(Math.abs(f.list[0].t - 0.5) < 1e-9);
});

test('dmg and crit floaters expire at 0.7s', () => {
  const f = createFloaters();
  addFloater(f, 0, 0, '1', 'dmg');
  addFloater(f, 0, 0, '2', 'crit');
  updateFloaters(f, 0.6);
  assert.equal(f.list.length, 2);
  updateFloaters(f, 0.15); // total 0.75 > 0.7
  assert.equal(f.list.length, 0);
});

test('combo and info floaters expire at 1.2s', () => {
  const f = createFloaters();
  addFloater(f, 0, 0, 'x5', 'combo');
  addFloater(f, 0, 0, 'WAVE', 'info');
  updateFloaters(f, 0.75); // past dmg lifetime but not combo/info
  assert.equal(f.list.length, 2);
  updateFloaters(f, 0.5); // total 1.25 > 1.2
  assert.equal(f.list.length, 0);
});

test('caps at 40 live floaters, dropping the oldest on add', () => {
  const f = createFloaters();
  for (let i = 0; i < 40; i++) addFloater(f, 0, 0, String(i), 'dmg');
  assert.equal(f.list.length, 40);
  addFloater(f, 0, 0, 'new', 'dmg');
  assert.equal(f.list.length, 40);
  assert.equal(f.list[0].text, '1'); // '0' (oldest) dropped
  assert.equal(f.list[39].text, 'new');
});
