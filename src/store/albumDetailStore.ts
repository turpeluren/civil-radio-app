import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  ensureCoverArtAuth,
  getAlbum,
  type AlbumWithSongsID3,
} from '../services/subsonicService';

export interface AlbumDetailEntry {
  album: AlbumWithSongsID3;
  /** Timestamp (Date.now()) when this entry was fetched from the server. */
  retrievedAt: number;
}

export interface AlbumDetailState {
  /** Album details indexed by album ID. */
  albums: Record<string, AlbumDetailEntry>;
  /** Fetch album from API, store it, and return it. Returns null on failure. */
  fetchAlbum: (id: string) => Promise<AlbumWithSongsID3 | null>;
  /** Clear all cached album details. */
  clearAlbums: () => void;
}

const PERSIST_KEY = 'substreamer-album-details';

export const albumDetailStore = create<AlbumDetailState>()(
  persist(
    (set, get) => ({
      albums: {},

      fetchAlbum: async (id: string) => {
        await ensureCoverArtAuth();
        const data = await getAlbum(id);
        if (data) {
          set({
            albums: {
              ...get().albums,
              [id]: { album: data, retrievedAt: Date.now() },
            },
          });
        }
        return data;
      },

      clearAlbums: () => set({ albums: {} }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        albums: state.albums,
      }),
    }
  )
);
