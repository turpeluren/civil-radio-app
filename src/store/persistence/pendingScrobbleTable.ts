/**
 * Per-row SQLite persistence for `pendingScrobbleStore` — query helpers
 * only. Mirrors `scrobbleTable.ts` (completed scrobbles) so the pair
 * stays on a single consistent model.
 *
 * Writes become silent no-ops when `getDb()` returns null (DB init failed)
 * — callers don't need to handle exceptions.
 */
import { getDb } from './db';
import { type PendingScrobble } from '../pendingScrobbleStore';

/* ------------------------------------------------------------------ */
/*  Reads                                                              */
/* ------------------------------------------------------------------ */

/**
 * Read every pending scrobble row in time order. Called once on app
 * start to hydrate `pendingScrobbleStore.pendingScrobbles`. Unparseable
 * rows are skipped; invalid rows (missing id / song.id / song.title)
 * are filtered so the store never sees garbage.
 */
export function hydratePendingScrobbles(): PendingScrobble[] {
  const db = getDb();
  if (db === null) return [];
  try {
    const rows = db.getAllSync<{ id: string; song_json: string; time: number }>(
      'SELECT id, song_json, time FROM pending_scrobble_events ORDER BY time ASC;',
    );
    const out: PendingScrobble[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.id || seen.has(row.id)) continue;
      let song: unknown;
      try {
        song = JSON.parse(row.song_json);
      } catch {
        continue;
      }
      if (
        !song ||
        typeof song !== 'object' ||
        !(song as { id?: unknown }).id ||
        !(song as { title?: unknown }).title
      ) {
        continue;
      }
      seen.add(row.id);
      out.push({ id: row.id, song: song as PendingScrobble['song'], time: row.time });
    }
    return out;
  } catch {
    return [];
  }
}

/** Diagnostic — total pending row count. */
export function countPendingScrobbles(): number {
  const db = getDb();
  if (db === null) return 0;
  try {
    const row = db.getFirstSync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM pending_scrobble_events;',
    );
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Writes                                                             */
/* ------------------------------------------------------------------ */

/**
 * Insert one pending scrobble. Uses INSERT OR IGNORE so re-inserting
 * the same id is a silent no-op (the store already dedupes in memory
 * but this protects against concurrent-call edge cases without throwing).
 */
export function insertPendingScrobble(scrobble: PendingScrobble): void {
  const db = getDb();
  if (db === null) return;
  if (!scrobble.id || !scrobble.song?.id || !scrobble.song.title) return;
  try {
    db.runSync(
      'INSERT OR IGNORE INTO pending_scrobble_events (id, song_json, time) VALUES (?, ?, ?);',
      [scrobble.id, JSON.stringify(scrobble.song), scrobble.time],
    );
  } catch {
    /* dropped */
  }
}

/**
 * Remove a single pending scrobble row. Called from
 * `scrobbleService.processScrobbles` after a successful server
 * submission (or when the item is already in the completed store).
 */
export function deletePendingScrobble(id: string): void {
  const db = getDb();
  if (db === null || !id) return;
  try {
    db.runSync('DELETE FROM pending_scrobble_events WHERE id = ?;', [id]);
  } catch {
    /* dropped */
  }
}

/**
 * Wipe and bulk-insert the full pending set inside a single
 * transaction. Used by the one-shot blob → per-row migration.
 * Invalid/duplicate records are filtered before insertion.
 */
export function replaceAllPendingScrobbles(
  scrobbles: readonly PendingScrobble[],
): void {
  const db = getDb();
  if (db === null) return;
  try {
    db.withTransactionSync(() => {
      db.runSync('DELETE FROM pending_scrobble_events;');
      const seen = new Set<string>();
      for (const s of scrobbles) {
        if (!s?.id || !s.song?.id || !s.song.title) continue;
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        db.runSync(
          'INSERT OR IGNORE INTO pending_scrobble_events (id, song_json, time) VALUES (?, ?, ?);',
          [s.id, JSON.stringify(s.song), s.time],
        );
      }
    });
  } catch {
    /* dropped */
  }
}

/** Remove every row. Used on logout via resetAllStores. */
export function clearPendingScrobbles(): void {
  const db = getDb();
  if (db === null) return;
  try {
    db.runSync('DELETE FROM pending_scrobble_events;');
  } catch {
    /* dropped */
  }
}
