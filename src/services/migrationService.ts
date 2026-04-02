/**
 * Data migration service.
 *
 * Defines versioned migration tasks that run sequentially on app launch.
 * Each task has a numeric `id` (1-based, strictly increasing). The
 * migration runner compares these IDs against the store's
 * `completedVersion` to determine which tasks still need to run.
 *
 * See the bottom of this file for a template showing how to add new tasks.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { completedScrobbleStore } from '../store/completedScrobbleStore';
import { mbidOverrideStore } from '../store/mbidOverrideStore';
import { sqliteStorage } from '../store/sqliteStorage';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MigrationTask {
  /** Sequential ID starting at 1. Must be unique and increasing. */
  id: number;
  /** Short name shown to the user during migration. */
  name: string;
  /** The work to perform. Use `log` to record findings. Throw on unrecoverable failure. */
  run: (log: (message: string) => void) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Task definitions                                                   */
/* ------------------------------------------------------------------ */

const MIGRATION_TASKS: MigrationTask[] = [
  {
    id: 1,
    name: 'Legacy data migration',
    run: async (log) => {
      // Cordova cache folder names used across app versions.
      // 'music' and 'images' are from the earliest Substreamer releases;
      // 'musicCache', 'imageCache', 'podcastCache' from later versions.
      const legacyDirs = [
        'imageCache',
        'musicCache',
        'podcastCache',
        'images',
        'music',
      ];

      // cordova.file.dataDirectory maps to different native paths per platform:
      //   Android: getFilesDir()         → same as Expo Paths.document
      //   iOS:     Library/NoCloud/       → NOT Documents/
      // We also check the Cordova "internal" persistent root on Android
      // (getFilesDir() + "/files/") in case the W3C persistent API was used.
      const bases: Directory[] = [Paths.document];

      if (Platform.OS === 'android') {
        // Cordova "internal" persistent root: getFilesDir() + "/files/"
        bases.push(new Directory(Paths.document, 'files'));
      } else if (Platform.OS === 'ios') {
        // cordova.file.dataDirectory on iOS: Library/NoCloud/
        bases.push(
          new Directory(Paths.document.parentDirectory, 'Library', 'NoCloud'),
        );
      }

      for (const base of bases) {
        for (const name of legacyDirs) {
          const dir = new Directory(base, name);
          if (dir.exists) {
            try {
              dir.delete();
              log(`Removed: ${base.uri}${name}/`);
            } catch {
              log(`Failed to remove: ${base.uri}${name}/`);
            }
          } else {
            log(`Not found: ${base.uri}${name}/`);
          }
        }
      }
    },
  },

  {
    id: 2,
    name: 'Remove legacy Ionic database',
    run: async (log) => {
      let dbDir: Directory | undefined;

      if (Platform.OS === 'ios') {
        dbDir = new Directory(
          Paths.document.parentDirectory,
          'Library',
          'LocalDatabase',
        );
      } else if (Platform.OS === 'android') {
        dbDir = new Directory(Paths.document.parentDirectory, 'databases');
      }

      if (!dbDir?.exists) {
        log(`Database directory not found: ${dbDir?.uri ?? 'unknown'}`);
        return;
      }

      log(`Checking directory: ${dbDir.uri}`);

      const suffixes = ['', '-journal', '-wal', '-shm'];
      const basenames = ['__substreamer3', '__substreamer3.db'];

      for (const base of basenames) {
        for (const suffix of suffixes) {
          const fileName = base + suffix;
          const file = new File(dbDir, fileName);
          if (file.exists) {
            try {
              file.delete();
              log(`Removed: ${fileName}`);
            } catch {
              log(`Failed to remove: ${fileName}`);
            }
          } else {
            log(`Not found: ${fileName}`);
          }
        }
      }
    },
  },

  {
    id: 3,
    name: 'Build analytics aggregates',
    run: async (log) => {
      const state = completedScrobbleStore.getState();
      if (state.completedScrobbles.length === 0) {
        log('No scrobbles — skipping aggregate rebuild.');
        return;
      }
      state.rebuildAggregates();
      log(`Rebuilt aggregates for ${state.completedScrobbles.length} scrobbles.`);
    },
  },

  {
    id: 4,
    name: 'Fix corrupted shares data',
    run: async (log) => {
      const raw = await sqliteStorage.getItem('substreamer-shares');
      if (!raw) {
        log('No persisted shares data — skipping.');
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        const state = parsed?.state;
        if (state && !Array.isArray(state.shares)) {
          state.shares = [];
          sqliteStorage.setItem('substreamer-shares', JSON.stringify(parsed));
          log(`Fixed corrupted shares field (was ${typeof state.shares}).`);
        } else {
          log('Shares data is valid — no fix needed.');
        }
      } catch {
        /* Corrupted JSON — remove it entirely so the store starts fresh */
        sqliteStorage.removeItem('substreamer-shares');
        log('Removed unparseable shares data.');
      }
    },
  },

  {
    id: 5,
    name: 'Migrate MBID overrides to new shape',
    run: async (log) => {
      const overrides = mbidOverrideStore.getState().overrides;
      const keys = Object.keys(overrides);
      if (keys.length === 0) {
        log('No MBID overrides — skipping.');
        return;
      }

      // Check if already migrated (new keys use "artist:" or "album:" prefix)
      const alreadyMigrated = keys.some((k) => k.startsWith('artist:') || k.startsWith('album:'));
      if (alreadyMigrated) {
        log('MBID overrides already in new format — skipping.');
        return;
      }

      // Old format: keyed by artistId with { artistId, artistName, mbid }
      // New format: keyed by "artist:{artistId}" with { type, entityId, entityName, mbid }
      const migrated: Record<string, { type: 'artist'; entityId: string; entityName: string; mbid: string }> = {};
      for (const key of keys) {
        const entry = overrides[key] as any;
        const entityId = entry.artistId ?? entry.entityId ?? key;
        const entityName = entry.artistName ?? entry.entityName ?? '';
        migrated[`artist:${entityId}`] = {
          type: 'artist',
          entityId,
          entityName,
          mbid: entry.mbid,
        };
      }

      mbidOverrideStore.setState({ overrides: migrated });
      log(`Migrated ${keys.length} MBID override(s) to new format.`);
    },
  },

  {
    id: 6,
    name: 'Set platform default for estimate content length',
    run: async (log) => {
      const raw = await sqliteStorage.getItem('substreamer-playback-settings');
      if (!raw) {
        log('No persisted playback settings — new default will apply.');
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        const state = parsed?.state;
        if (!state) {
          log('No state in persisted data — skipping.');
          return;
        }
        const desired = Platform.OS === 'android';
        state.estimateContentLength = desired;
        sqliteStorage.setItem('substreamer-playback-settings', JSON.stringify(parsed));
        log(`Set estimateContentLength to ${desired} (${Platform.OS}).`);
      } catch {
        log('Failed to parse playback settings — new default will apply.');
      }
    },
  },

  // -------------------------------------------------------------------
  // TEMPLATE – How to add a new migration task:
  //
  //   1. Add a new entry below with the next sequential `id`.
  //   2. Give it a human-readable `name` (shown briefly on the splash).
  //   3. Implement the async `run` function with the migration logic.
  //   4. The runner will pick it up automatically on next launch for
  //      any user whose completedVersion is below the new id.
  //
  // Example:
  //
  // {
  //   id: 7,
  //   name: 'Reset playback settings',
  //   run: async () => {
  //     // your migration logic here
  //   },
  // },
  // -------------------------------------------------------------------
];

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns tasks that have not yet been completed.
 */
export function getPendingTasks(completedVersion: number): MigrationTask[] {
  return MIGRATION_TASKS.filter((t) => t.id > completedVersion);
}

/**
 * Run all pending migration tasks sequentially.
 *
 * @param completedVersion – The highest task ID already completed.
 * @param onProgress       – Optional callback fired before each task runs.
 * @returns The new completedVersion (highest task ID that ran).
 */
export async function runMigrations(
  completedVersion: number,
  onProgress?: (task: MigrationTask) => void,
): Promise<number> {
  const pending = getPendingTasks(completedVersion);
  const lines: string[] = [];

  lines.push(`Migration run: ${new Date().toISOString()}`);
  lines.push(`Platform: ${Platform.OS}`);
  lines.push('');

  for (const task of pending) {
    onProgress?.(task);
    lines.push(`--- Task ${task.id}: ${task.name} ---`);
    await task.run((msg) => lines.push(msg));
    completedVersion = task.id;
    lines.push('');
  }

  const logFile = new File(Paths.document, 'migration-log.txt');
  logFile.write(lines.join('\n'));

  return completedVersion;
}
