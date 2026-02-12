import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  ensureCoverArtAuth,
  getPlaylist,
  type PlaylistWithSongs,
} from '../services/subsonicService';

export interface PlaylistDetailEntry {
  playlist: PlaylistWithSongs;
  /** Timestamp (Date.now()) when this entry was fetched from the server. */
  retrievedAt: number;
}

export interface PlaylistDetailState {
  /** Playlist details indexed by playlist ID. */
  playlists: Record<string, PlaylistDetailEntry>;
  /** Fetch playlist from API, store it, and return it. Returns null on failure. */
  fetchPlaylist: (id: string) => Promise<PlaylistWithSongs | null>;
  /** Clear all cached playlist details. */
  clearPlaylists: () => void;
}

const PERSIST_KEY = 'substreamer-playlist-details';

export const playlistDetailStore = create<PlaylistDetailState>()(
  persist(
    (set, get) => ({
      playlists: {},

      fetchPlaylist: async (id: string) => {
        await ensureCoverArtAuth();
        const data = await getPlaylist(id);
        if (data) {
          set({
            playlists: {
              ...get().playlists,
              [id]: { playlist: data, retrievedAt: Date.now() },
            },
          });
        }
        return data;
      },

      clearPlaylists: () => set({ playlists: {} }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        playlists: state.playlists,
      }),
    }
  )
);
