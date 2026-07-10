import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legendRows, bossRow, pickupRows, CONTACT_DMG } from '../src/legend.js';
import { ENEMIES, GEMS } from '../src/config.js';

const NONBOSS = Object.keys(ENEMIES).filter(k => k !== 'boss');

test('every non-boss ENEMIES key has exactly one row with stats mirrored from config', () => {
  const rows = legendRows();
  assert.equal(rows.length, NONBOSS.length);
  for (const type of NONBOSS) {
    const matches = rows.filter(r => r.type === type);
    assert.equal(matches.length, 1, `exactly one row for ${type}`);
    const r = matches[0];
    const def = ENEMIES[type];
    assert.equal(r.hp, def.hp, `${type} hp`);
    assert.equal(r.speed, def.speed, `${type} speed`);
    assert.equal(r.score, def.score, `${type} score`);
    assert.equal(r.dmg, CONTACT_DMG, `${type} dmg is the engine's flat contact damage`);
  }
  // No boss leaks into the enemy rows.
  assert.ok(!rows.some(r => r.type === 'boss'));
});

test('boss is not hand-copied: legendRows never invents extra rows', () => {
  const rows = legendRows();
  const types = rows.map(r => r.type).sort();
  assert.deepEqual(types, [...NONBOSS].sort());
});

test('every row has a non-empty blurb', () => {
  for (const r of legendRows()) {
    assert.equal(typeof r.blurb, 'string');
    assert.ok(r.blurb.length > 0, `${r.type} blurb non-empty`);
  }
});

test('every row has a non-empty display name', () => {
  for (const r of legendRows()) {
    assert.equal(typeof r.name, 'string');
    assert.ok(r.name.length > 0, `${r.type} name non-empty`);
  }
});

test('unlock waves track ENEMIES config exactly', () => {
  const rows = legendRows();
  for (const r of rows) {
    assert.equal(r.unlock, ENEMIES[r.type].unlock, `${r.type} unlock`);
  }
});

test('mini row carries a spawned-by note instead of an unlock wave', () => {
  const mini = legendRows().find(r => r.type === 'mini');
  assert.ok(mini, 'mini row exists');
  assert.equal(mini.unlock, undefined, 'mini has no unlock wave');
  assert.ok(mini.note && mini.note.length > 0, 'mini has a note');
});

test('bossRow lists exactly 3 phases and mirrors boss config', () => {
  const b = bossRow();
  assert.equal(b.type, 'boss');
  assert.equal(b.hp, ENEMIES.boss.hp);
  assert.equal(b.speed, ENEMIES.boss.speed);
  assert.equal(b.score, ENEMIES.boss.score);
  assert.equal(b.dmg, CONTACT_DMG);
  assert.ok(Array.isArray(b.phases));
  assert.equal(b.phases.length, 3, 'three phases');
  for (const p of b.phases) assert.ok(typeof p === 'string' && p.length > 0);
  assert.ok(b.cadence && b.cadence.length > 0);
  assert.ok(b.drop && b.drop.length > 0);
});

test('pickup rows derive percentages from GEMS config', () => {
  const rows = pickupRows();
  const blue = rows.find(r => r.kind === 'blue');
  const red = rows.find(r => r.kind === 'red');
  assert.ok(blue && red, 'both pickup rows present');
  assert.ok(blue.effect.includes(`${Math.round(GEMS.boostFill * 100)}%`), 'blue tracks boostFill');
  assert.ok(red.effect.includes(`${Math.round(GEMS.heartFill * 100)}%`), 'red tracks heartFill');
});

test('pickup percentages move with config (25% blue, 10% red at current tuning)', () => {
  const rows = pickupRows();
  const blue = rows.find(r => r.kind === 'blue');
  const red = rows.find(r => r.kind === 'red');
  assert.ok(blue.effect.includes('25%'));
  assert.ok(red.effect.includes('10%'));
});
