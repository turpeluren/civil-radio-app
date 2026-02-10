import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ItemLayout = 'list' | 'grid';

export interface LayoutPreferencesState {
  albumLayout: ItemLayout;
  artistLayout: ItemLayout;
  playlistLayout: ItemLayout;
  setAlbumLayout: (layout: ItemLayout) => void;
  setArtistLayout: (layout: ItemLayout) => void;
  setPlaylistLayout: (layout: ItemLayout) => void;
}

const PERSIST_KEY = 'substreamer-layout-preferences';

export const layoutPreferencesStore = create<LayoutPreferencesState>()(
  persist(
    (set) => ({
      albumLayout: 'list',
      artistLayout: 'list',
      playlistLayout: 'list',
      setAlbumLayout: (albumLayout) => set({ albumLayout }),
      setArtistLayout: (artistLayout) => set({ artistLayout }),
      setPlaylistLayout: (playlistLayout) => set({ playlistLayout }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        albumLayout: state.albumLayout,
        artistLayout: state.artistLayout,
        playlistLayout: state.playlistLayout,
      }),
    }
  )
);
