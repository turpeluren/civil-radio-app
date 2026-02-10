import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  ensureCoverArtAuth,
  getAllPlaylists,
  type Playlist,
} from '../services/subsonicService';

export interface PlaylistLibraryState {
  /** All playlists in the user's library */
  playlists: Playlist[];
  /** Whether a fetch is currently in progress */
  loading: boolean;
  /** Last error message, if any */
  error: string | null;
  /** Timestamp of the last successful fetch */
  lastFetchedAt: number | null;

  /** Fetch all playlists from the server via getPlaylists. */
  fetchAllPlaylists: () => Promise<void>;
  /** Clear all playlist data */
  clearPlaylists: () => void;
}

const PERSIST_KEY = 'substreamer-playlist-library';

export const playlistLibraryStore = create<PlaylistLibraryState>()(
  persist(
    (set, get) => ({
      playlists: [],
      loading: false,
      error: null,
      lastFetchedAt: null,

      fetchAllPlaylists: async () => {
        // Prevent duplicate fetches
        if (get().loading) return;

        set({ loading: true, error: null });
        try {
          await ensureCoverArtAuth();
          const playlists = await getAllPlaylists();

          set({
            playlists,
            loading: false,
            lastFetchedAt: Date.now(),
          });
        } catch (e) {
          set({
            loading: false,
            error: e instanceof Error ? e.message : 'Failed to load playlists',
          });
        }
      },

      clearPlaylists: () =>
        set({
          playlists: [],
          loading: false,
          error: null,
          lastFetchedAt: null,
        }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        playlists: state.playlists,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);
