import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { sqliteStorage } from './sqliteStorage';

interface BackupState {
  autoBackupEnabled: boolean;
  lastBackupTimes: Record<string, number>;

  setAutoBackupEnabled: (enabled: boolean) => void;
  setLastBackupTime: (identityKey: string, time: number) => void;
  getLastBackupTime: (identityKey: string) => number | null;
}

const PERSIST_KEY = 'substreamer-backup-settings';

export function migrateBackupState(persisted: any, version: number) {
  if (version === 0 || version === undefined) {
    // Migrate from scalar lastBackupTime to keyed lastBackupTimes.
    // We can't determine which identity the old value belonged to, so discard it.
    // Worst case: one extra auto-backup fires on the next launch.
    const { lastBackupTime: _, ...rest } = persisted;
    return { ...rest, lastBackupTimes: {} };
  }
  return persisted;
}

export const backupStore = create<BackupState>()(
  persist(
    (set, get) => ({
      autoBackupEnabled: true,
      lastBackupTimes: {},

      setAutoBackupEnabled: (autoBackupEnabled) => set({ autoBackupEnabled }),
      setLastBackupTime: (identityKey, time) =>
        set((s) => ({ lastBackupTimes: { ...s.lastBackupTimes, [identityKey]: time } })),
      getLastBackupTime: (identityKey) => get().lastBackupTimes[identityKey] ?? null,
    }),
    {
      name: PERSIST_KEY,
      version: 1,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({
        autoBackupEnabled: state.autoBackupEnabled,
        lastBackupTimes: state.lastBackupTimes,
      }),
      migrate: migrateBackupState,
    }
  )
);
