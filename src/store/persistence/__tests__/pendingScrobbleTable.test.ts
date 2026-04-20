// Mock expo-sqlite with a minimal no-op DB so `persistence/db.ts`'s
// module-scope init succeeds on import. Individual tests override the
// shared handle via `db.__setDbForTests` with a richer fake.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    getFirstSync: () => undefined,
    getAllSync: () => [],
    runSync: () => {},
    execSync: () => {},
    withTransactionSync: (fn: () => void) => fn(),
  }),
}));

import { __setDbForTests } from '../db';
import {
  clearPendingScrobbles,
  countPendingScrobbles,
  deletePendingScrobble,
  hydratePendingScrobbles,
  insertPendingScrobble,
  replaceAllPendingScrobbles,
} from '../pendingScrobbleTable';

/** Minimal InternalDb fake that records rows in a Map keyed by id. */
function makeFakeDb() {
  const rows = new Map<string, { id: string; song_json: string; time: number }>();

  const runSync = (sql: string, params: readonly unknown[] = []): void => {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.startsWith('INSERT OR IGNORE INTO pending_scrobble_events')) {
      const [id, song_json, time] = params as [string, string, number];
      if (!rows.has(id)) {
        rows.set(id, { id, song_json, time });
      }
    } else if (s.startsWith('DELETE FROM pending_scrobble_events WHERE id =')) {
      const [id] = params as [string];
      rows.delete(id);
    } else if (s.startsWith('DELETE FROM pending_scrobble_events')) {
      rows.clear();
    } else {
      throw new Error(`unhandled SQL in fake: ${s}`);
    }
  };

  return {
    rows,
    getFirstSync<T>(sql: string): T | undefined {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.includes('COUNT(*) AS c FROM pending_scrobble_events')) {
        return { c: rows.size } as T;
      }
      return undefined;
    },
    getAllSync<T>(sql: string): T[] {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.startsWith('SELECT id, song_json, time FROM pending_scrobble_events')) {
        // Mimic ORDER BY time ASC so hydrate-order assertions are meaningful.
        return Array.from(rows.values()).sort((a, b) => a.time - b.time) as T[];
      }
      return [];
    },
    runSync,
    execSync: () => {},
    withTransactionSync: (fn: () => void) => fn(),
  };
}

function makePending(overrides?: Record<string, any>): any {
  return {
    id: 'p-1',
    song: { id: 's1', title: 'Song One', artist: 'Artist', duration: 180 },
    time: 1_700_000_000_000,
    ...overrides,
  };
}

let fakeDb: ReturnType<typeof makeFakeDb>;

beforeEach(() => {
  fakeDb = makeFakeDb();
  __setDbForTests(fakeDb as any);
});

afterEach(() => {
  __setDbForTests(null);
});

describe('pendingScrobbleTable — insert + hydrate', () => {
  it('insertPendingScrobble + hydratePendingScrobbles round-trip preserves fields', () => {
    const s = makePending();
    insertPendingScrobble(s);

    const restored = hydratePendingScrobbles();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe('p-1');
    expect(restored[0].time).toBe(1_700_000_000_000);
    expect(restored[0].song.id).toBe('s1');
    expect(restored[0].song.title).toBe('Song One');
    expect(restored[0].song.artist).toBe('Artist');
  });

  it('insertPendingScrobble is INSERT OR IGNORE — duplicate ids are silently skipped', () => {
    insertPendingScrobble(makePending({ id: 'dup', time: 1 }));
    insertPendingScrobble(makePending({ id: 'dup', time: 999, song: { id: 's2', title: 'Different' } }));

    expect(countPendingScrobbles()).toBe(1);
    const restored = hydratePendingScrobbles();
    expect(restored[0].time).toBe(1);
    expect(restored[0].song.id).toBe('s1');
  });

  it('insertPendingScrobble skips records missing id / song.id / song.title', () => {
    insertPendingScrobble(makePending({ id: '' }));
    insertPendingScrobble(makePending({ id: 'bad-song-id', song: { id: '', title: 'x' } }));
    insertPendingScrobble(makePending({ id: 'no-title', song: { id: 's1', title: '' } }));
    insertPendingScrobble(makePending({ id: 'null-song', song: null }));

    expect(countPendingScrobbles()).toBe(0);
  });

  it('hydratePendingScrobbles returns rows in time-ascending order', () => {
    insertPendingScrobble(makePending({ id: 'a', time: 300 }));
    insertPendingScrobble(makePending({ id: 'b', time: 100 }));
    insertPendingScrobble(makePending({ id: 'c', time: 200 }));

    const restored = hydratePendingScrobbles();
    expect(restored.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('hydratePendingScrobbles returns empty when table is empty', () => {
    expect(hydratePendingScrobbles()).toEqual([]);
  });

  it('hydratePendingScrobbles skips unparseable song_json rows', () => {
    fakeDb.rows.set('good', {
      id: 'good',
      song_json: JSON.stringify({ id: 's1', title: 'OK' }),
      time: 1,
    });
    fakeDb.rows.set('bad', { id: 'bad', song_json: '{not valid', time: 2 });

    const restored = hydratePendingScrobbles();
    expect(restored.map((s) => s.id)).toEqual(['good']);
  });

  it('hydratePendingScrobbles filters rows whose decoded song is invalid', () => {
    fakeDb.rows.set('missing-song-id', {
      id: 'missing-song-id',
      song_json: JSON.stringify({ title: 'no id' }),
      time: 1,
    });
    fakeDb.rows.set('missing-title', {
      id: 'missing-title',
      song_json: JSON.stringify({ id: 's1' }),
      time: 2,
    });
    fakeDb.rows.set('null-decoded', { id: 'null-decoded', song_json: 'null', time: 3 });
    fakeDb.rows.set('ok', {
      id: 'ok',
      song_json: JSON.stringify({ id: 's9', title: 'Valid' }),
      time: 4,
    });

    const restored = hydratePendingScrobbles();
    expect(restored.map((s) => s.id)).toEqual(['ok']);
  });
});

describe('pendingScrobbleTable — deletePendingScrobble', () => {
  it('removes a single row by id', () => {
    insertPendingScrobble(makePending({ id: 'a' }));
    insertPendingScrobble(makePending({ id: 'b' }));
    insertPendingScrobble(makePending({ id: 'c' }));
    expect(countPendingScrobbles()).toBe(3);

    deletePendingScrobble('b');
    const restored = hydratePendingScrobbles();
    expect(restored.map((s) => s.id).sort()).toEqual(['a', 'c']);
  });

  it('is a no-op for ids that do not exist', () => {
    insertPendingScrobble(makePending({ id: 'a' }));
    deletePendingScrobble('missing');
    expect(countPendingScrobbles()).toBe(1);
  });

  it('skips empty-string ids', () => {
    insertPendingScrobble(makePending({ id: 'a' }));
    deletePendingScrobble('');
    expect(countPendingScrobbles()).toBe(1);
  });
});

describe('pendingScrobbleTable — replaceAllPendingScrobbles', () => {
  it('wipes existing rows and inserts the new set', () => {
    insertPendingScrobble(makePending({ id: 'old-1' }));
    insertPendingScrobble(makePending({ id: 'old-2' }));
    expect(countPendingScrobbles()).toBe(2);

    replaceAllPendingScrobbles([
      makePending({ id: 'new-1', time: 5 }),
      makePending({ id: 'new-2', time: 10 }),
    ]);

    expect(countPendingScrobbles()).toBe(2);
    const restored = hydratePendingScrobbles();
    expect(restored.map((s) => s.id).sort()).toEqual(['new-1', 'new-2']);
  });

  it('drops invalid / duplicate records before inserting', () => {
    replaceAllPendingScrobbles([
      makePending({ id: 'ok' }),
      makePending({ id: 'ok' }),
      makePending({ id: '' }),
      makePending({ id: 'bad-song', song: { id: '', title: 'x' } }),
      makePending({ id: 'no-title', song: { id: 's1', title: '' } }),
      makePending({ id: 'null-song', song: null }),
    ] as any);

    expect(countPendingScrobbles()).toBe(1);
    const restored = hydratePendingScrobbles();
    expect(restored[0].id).toBe('ok');
  });

  it('replaceAllPendingScrobbles with empty array clears the table', () => {
    insertPendingScrobble(makePending({ id: 'a' }));
    replaceAllPendingScrobbles([]);
    expect(countPendingScrobbles()).toBe(0);
  });
});

describe('pendingScrobbleTable — clearPendingScrobbles', () => {
  it('wipes the table', () => {
    insertPendingScrobble(makePending({ id: 'a' }));
    insertPendingScrobble(makePending({ id: 'b' }));
    clearPendingScrobbles();
    expect(countPendingScrobbles()).toBe(0);
    expect(hydratePendingScrobbles()).toEqual([]);
  });

  it('is safe to call on an empty table', () => {
    expect(() => clearPendingScrobbles()).not.toThrow();
    expect(countPendingScrobbles()).toBe(0);
  });
});

describe('pendingScrobbleTable — disabled db path', () => {
  beforeEach(() => {
    __setDbForTests(null);
  });

  it('all mutations are no-ops when db is unavailable', () => {
    insertPendingScrobble(makePending());
    deletePendingScrobble('p-1');
    replaceAllPendingScrobbles([makePending()]);
    clearPendingScrobbles();
    expect(countPendingScrobbles()).toBe(0);
    expect(hydratePendingScrobbles()).toEqual([]);
  });
});

describe('pendingScrobbleTable — db throws (error swallow path)', () => {
  const throwingDb = {
    getFirstSync() {
      throw new Error('boom');
    },
    getAllSync() {
      throw new Error('boom');
    },
    runSync() {
      throw new Error('boom');
    },
    execSync() {
      throw new Error('boom');
    },
    withTransactionSync() {
      throw new Error('boom');
    },
  };

  beforeEach(() => {
    __setDbForTests(throwingDb as any);
  });

  it('mutations swallow errors and do not propagate', () => {
    expect(() => insertPendingScrobble(makePending())).not.toThrow();
    expect(() => deletePendingScrobble('x')).not.toThrow();
    expect(() => replaceAllPendingScrobbles([makePending()])).not.toThrow();
    expect(() => clearPendingScrobbles()).not.toThrow();
  });

  it('reads return safe defaults on DB error', () => {
    expect(countPendingScrobbles()).toBe(0);
    expect(hydratePendingScrobbles()).toEqual([]);
  });
});
