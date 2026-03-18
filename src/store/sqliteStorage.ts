import * as SQLite from 'expo-sqlite';
import { type StateStorage } from 'zustand/middleware';

const db = SQLite.openDatabaseSync('substreamer7.db');

// Performance and reliability (expo-sqlite PRAGMA surface)
db.execSync('PRAGMA journal_mode = WAL;');
db.execSync('PRAGMA synchronous = NORMAL;');
db.execSync('PRAGMA foreign_keys = ON;');

db.execSync(
  'CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);'
);

export const sqliteStorage: StateStorage = {
  getItem(key: string): string | null {
    const row = db.getFirstSync<{ value: string }>(
      'SELECT value FROM storage WHERE key = ?;',
      [key]
    );
    return row?.value ?? null;
  },
  setItem(key: string, value: string): void {
    db.runSync(
      'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?);',
      [key, value]
    );
  },
  removeItem(key: string): void {
    db.runSync('DELETE FROM storage WHERE key = ?;', [key]);
  },
};

/** Delete every row from the storage table — used by logout. */
export function clearAllStorage(): void {
  db.runSync('DELETE FROM storage;');
}
