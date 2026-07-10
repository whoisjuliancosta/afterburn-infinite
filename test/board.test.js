import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBoard, recordRun, saveBoard, placed, displayName } from '../src/board.js';

// --- recordRun ---

test('recordRun sorts descending by score', () => {
  let board = [];
  board = recordRun(board, { score: 100, wave: 3, date: '2026-07-10' });
  board = recordRun(board, { score: 300, wave: 5, date: '2026-07-10' });
  board = recordRun(board, { score: 200, wave: 4, date: '2026-07-10' });
  assert.deepEqual(board.map((e) => e.score), [300, 200, 100]);
});

test('recordRun caps the board at 5 entries', () => {
  let board = [];
  for (const s of [10, 20, 30, 40, 50, 60, 70]) {
    board = recordRun(board, { score: s, wave: 1, date: '2026-07-10' });
  }
  assert.equal(board.length, 5);
  assert.deepEqual(board.map((e) => e.score), [70, 60, 50, 40, 30]);
});

test('recordRun tie behavior is stable: earlier entries keep the higher rank', () => {
  let board = [];
  board = recordRun(board, { score: 100, wave: 3, date: 'first' });
  board = recordRun(board, { score: 100, wave: 3, date: 'second' });
  assert.deepEqual(board.map((e) => e.date), ['first', 'second']);
});

test('recordRun does not mutate the input array or its entries', () => {
  const board = [{ score: 200, wave: 4, date: 'old' }];
  const snapshot = JSON.parse(JSON.stringify(board));
  const next = recordRun(board, { score: 300, wave: 5, date: 'new' });
  assert.notEqual(next, board);
  assert.deepEqual(board, snapshot);
});

test('recordRun keeps only score/wave/date/name fields on the new entry', () => {
  const board = recordRun([], { score: 100, wave: 2, date: 'd', name: 'ACE', junk: 'x' });
  assert.deepEqual(board[0], { score: 100, wave: 2, date: 'd', name: 'ACE' });
});

// --- name handling ---

test('recordRun stores an uppercased, trimmed name', () => {
  const board = recordRun([], { score: 100, wave: 2, date: 'd', name: '  maverick  ' });
  assert.equal(board[0].name, 'MAVERICK');
});

test('recordRun clamps the name to 12 chars', () => {
  const board = recordRun([], { score: 100, wave: 2, date: 'd', name: 'ABCDEFGHIJKLMNOP' });
  assert.equal(board[0].name, 'ABCDEFGHIJKL');
  assert.equal(board[0].name.length, 12);
});

test('recordRun clamps after trimming whitespace', () => {
  const board = recordRun([], { score: 100, wave: 2, date: 'd', name: '   longpilotname123   ' });
  assert.equal(board[0].name, 'LONGPILOTNAM');
});

test('recordRun falls back to PILOT on empty name', () => {
  const board = recordRun([], { score: 100, wave: 2, date: 'd', name: '' });
  assert.equal(board[0].name, 'PILOT');
});

test('recordRun falls back to PILOT on whitespace-only name', () => {
  const board = recordRun([], { score: 100, wave: 2, date: 'd', name: '   ' });
  assert.equal(board[0].name, 'PILOT');
});

test('recordRun falls back to PILOT when name is missing', () => {
  const board = recordRun([], { score: 100, wave: 2, date: 'd' });
  assert.equal(board[0].name, 'PILOT');
});

test('recordRun name does not affect sort order (score decides)', () => {
  let board = [];
  board = recordRun(board, { score: 100, wave: 3, date: 'a', name: 'ZZZ' });
  board = recordRun(board, { score: 300, wave: 5, date: 'b', name: 'AAA' });
  board = recordRun(board, { score: 200, wave: 4, date: 'c', name: 'MMM' });
  assert.deepEqual(board.map((e) => e.score), [300, 200, 100]);
  assert.deepEqual(board.map((e) => e.name), ['AAA', 'MMM', 'ZZZ']);
});

// --- legacy tolerance ---

test('recordRun onto a legacy board (entries without name) does not break', () => {
  const legacy = [
    { score: 500, wave: 6, date: 'x' },
    { score: 100, wave: 2, date: 'y' },
  ];
  const board = recordRun(legacy, { score: 300, wave: 4, date: 'z', name: 'NEW' });
  assert.deepEqual(board.map((e) => e.score), [500, 300, 100]);
  // legacy entries pass through untouched (no migration write)
  assert.equal(board[0].name, undefined);
  assert.equal(board[2].name, undefined);
  assert.equal(board[1].name, 'NEW');
});

test('placed still works with legacy entries that have no name', () => {
  const board = [
    { score: 300, wave: 5, date: 'a' },
    { score: 200, wave: 4, date: 'b' },
  ];
  assert.equal(placed(board, { score: 200, wave: 4, date: 'b' }), 1);
});

test('displayName returns the stored name', () => {
  assert.equal(displayName({ score: 1, wave: 1, date: 'd', name: 'ACE' }), 'ACE');
});

test('displayName falls back to PILOT for legacy entries with no name', () => {
  assert.equal(displayName({ score: 1, wave: 1, date: 'd' }), 'PILOT');
});

test('displayName falls back to PILOT for empty/whitespace name', () => {
  assert.equal(displayName({ name: '' }), 'PILOT');
  assert.equal(displayName({ name: '   ' }), 'PILOT');
});

// --- placed ---

test('placed returns the index of an entry on the board', () => {
  const board = [
    { score: 300, wave: 5, date: 'a' },
    { score: 200, wave: 4, date: 'b' },
    { score: 100, wave: 3, date: 'c' },
  ];
  assert.equal(placed(board, board[1]), 1);
});

test('placed returns -1 when the entry did not place', () => {
  const board = [{ score: 300, wave: 5, date: 'a' }];
  assert.equal(placed(board, { score: 50, wave: 1, date: 'z' }), -1);
});

test('placed matches by value, not reference', () => {
  const board = [{ score: 300, wave: 5, date: 'a' }];
  assert.equal(placed(board, { score: 300, wave: 5, date: 'a' }), 0);
});

// --- loadBoard / saveBoard storage safety ---

function withStorage(store, fn) {
  const prev = globalThis.localStorage;
  globalThis.localStorage = store;
  try { return fn(); }
  finally {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
  }
}

function memStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('loadBoard returns [] when localStorage is absent', () => {
  withStorage(undefined, () => {
    assert.deepEqual(loadBoard(), []);
  });
});

test('loadBoard returns [] on malformed JSON', () => {
  const store = memStore();
  store.setItem('np-shooter-board', '{not json');
  withStorage(store, () => {
    assert.deepEqual(loadBoard(), []);
  });
});

test('loadBoard returns [] when stored value is not an array', () => {
  const store = memStore();
  store.setItem('np-shooter-board', '{"score":1}');
  withStorage(store, () => {
    assert.deepEqual(loadBoard(), []);
  });
});

test('saveBoard then loadBoard round-trips', () => {
  const store = memStore();
  withStorage(store, () => {
    const board = recordRun([], { score: 500, wave: 6, date: '2026-07-10' });
    saveBoard(board);
    assert.deepEqual(loadBoard(), board);
  });
});

test('saveBoard is safe without localStorage', () => {
  withStorage(undefined, () => {
    assert.doesNotThrow(() => saveBoard([{ score: 1, wave: 1, date: 'd' }]));
  });
});

test('saveBoard swallows storage errors (private mode)', () => {
  const throwing = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
  };
  withStorage(throwing, () => {
    assert.doesNotThrow(() => saveBoard([{ score: 1, wave: 1, date: 'd' }]));
    assert.deepEqual(loadBoard(), []);
  });
});
