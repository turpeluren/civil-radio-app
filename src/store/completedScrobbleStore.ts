import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { sqliteStorage } from './sqliteStorage';

import { type Child } from '../services/subsonicService';

export interface CompletedScrobble {
  /** Unique identifier (carried over from the pending entry). */
  id: string;
  /** Full Subsonic songID3 object. */
  song: Child;
  /** Unix timestamp (ms) when playback completed. */
  time: number;
}

export interface ListeningStats {
  totalPlays: number;
  totalListeningSeconds: number;
  uniqueArtists: Record<string, true>;
}

const EMPTY_STATS: ListeningStats = {
  totalPlays: 0,
  totalListeningSeconds: 0,
  uniqueArtists: {},
};

export interface CompletedScrobbleState {
  completedScrobbles: CompletedScrobble[];
  stats: ListeningStats;

  addCompleted: (scrobble: CompletedScrobble) => void;
  rebuildStats: () => void;
}

function buildStats(scrobbles: CompletedScrobble[]): ListeningStats {
  let totalListeningSeconds = 0;
  const uniqueArtists: Record<string, true> = {};
  for (const s of scrobbles) {
    if (s.song.duration) totalListeningSeconds += s.song.duration;
    if (s.song.artist) uniqueArtists[s.song.artist] = true;
  }
  return { totalPlays: scrobbles.length, totalListeningSeconds, uniqueArtists };
}

const PERSIST_KEY = 'substreamer-completed-scrobbles';

export const completedScrobbleStore = create<CompletedScrobbleState>()(
  persist(
    (set, get) => ({
      completedScrobbles: [],
      stats: { ...EMPTY_STATS },

      addCompleted: (scrobble) =>
        set((state) => {
          if (
            !scrobble.id ||
            !scrobble.song?.id ||
            !scrobble.song.title ||
            state.completedScrobbles.some((s) => s.id === scrobble.id)
          ) {
            return state;
          }

          const artist = scrobble.song.artist;
          const newArtists =
            artist && !(artist in state.stats.uniqueArtists)
              ? { ...state.stats.uniqueArtists, [artist]: true as const }
              : state.stats.uniqueArtists;

          return {
            completedScrobbles: [...state.completedScrobbles, scrobble],
            stats: {
              totalPlays: state.stats.totalPlays + 1,
              totalListeningSeconds:
                state.stats.totalListeningSeconds + (scrobble.song.duration ?? 0),
              uniqueArtists: newArtists,
            },
          };
        }),

      rebuildStats: () => {
        const { completedScrobbles } = get();
        set({ stats: buildStats(completedScrobbles) });
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({
        completedScrobbles: state.completedScrobbles,
        stats: state.stats,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const seen = new Set<string>();
        const before = state.completedScrobbles.length;
        state.completedScrobbles = state.completedScrobbles.filter((s) => {
          if (!s.id || !s.song?.id || !s.song.title || seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
        if (state.completedScrobbles.length !== before) {
          state.rebuildStats();
          return;
        }

        if (
          state.stats.totalPlays === 0 &&
          state.completedScrobbles.length > 0
        ) {
          state.rebuildStats();
        }
      },
    }
  )
);
