import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { SegmentControl } from '../components/SegmentControl';
import { useTheme } from '../hooks/useTheme';
import { filterBarStore } from '../store/filterBarStore';
import { offlineModeStore } from '../store/offlineModeStore';
import { searchStore } from '../store/searchStore';
import {
  layoutPreferencesStore,
  type ItemLayout,
} from '../store/layoutPreferencesStore';
import { AlbumLibraryListScreen } from './album-library-list';
import { ArtistListScreen } from './artist-list';
import { PlaylistListScreen } from './playlist-list';

type LibrarySegment = 'albums' | 'artists' | 'playlists';

const SEGMENTS = [
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
  { key: 'playlists', label: 'Playlists' },
] as const;

/* ------------------------------------------------------------------ */
/*  LibraryScreen                                                     */
/* ------------------------------------------------------------------ */

export function LibraryScreen() {
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const headerHeight = searchStore((s) => s.headerHeight);
  const [activeSegment, setActiveSegment] = useState<LibrarySegment>('albums');

  const albumLayout = layoutPreferencesStore((s) => s.albumLayout);
  const artistLayout = layoutPreferencesStore((s) => s.artistLayout);
  const playlistLayout = layoutPreferencesStore((s) => s.playlistLayout);
  const setAlbumLayout = layoutPreferencesStore((s) => s.setAlbumLayout);
  const setArtistLayout = layoutPreferencesStore((s) => s.setArtistLayout);
  const setPlaylistLayout = layoutPreferencesStore((s) => s.setPlaylistLayout);

  const toggleAlbumLayout = useCallback(() => {
    setAlbumLayout(albumLayout === 'list' ? 'grid' : 'list');
  }, [albumLayout, setAlbumLayout]);

  const toggleArtistLayout = useCallback(() => {
    setArtistLayout(artistLayout === 'list' ? 'grid' : 'list');
  }, [artistLayout, setArtistLayout]);

  const togglePlaylistLayout = useCallback(() => {
    setPlaylistLayout(playlistLayout === 'list' ? 'grid' : 'list');
  }, [playlistLayout, setPlaylistLayout]);

  useEffect(() => {
    if (!isFocused) return;

    const layoutMap: Record<LibrarySegment, { layout: ItemLayout; toggle: () => void }> = {
      albums: { layout: albumLayout, toggle: toggleAlbumLayout },
      artists: { layout: artistLayout, toggle: toggleArtistLayout },
      playlists: { layout: playlistLayout, toggle: togglePlaylistLayout },
    };

    const current = layoutMap[activeSegment];
    const store = filterBarStore.getState();
    store.setLayoutToggle({
      layout: current.layout,
      onToggle: current.toggle,
    });
    store.setDownloadButtonConfig(null);
    store.setHideDownloaded(activeSegment === 'artists');
    store.setHideFavorites(activeSegment === 'playlists');
  }, [
    isFocused,
    activeSegment,
    albumLayout,
    artistLayout,
    playlistLayout,
    toggleAlbumLayout,
    toggleArtistLayout,
    togglePlaylistLayout,
  ]);

  const downloadedOnly = filterBarStore((s) => s.downloadedOnly);
  const favoritesOnly = filterBarStore((s) => s.favoritesOnly);
  const offlineMode = offlineModeStore((s) => s.offlineMode);

  const segmentHeight = 52;
  const contentInsetTop = headerHeight + segmentHeight;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {activeSegment === 'albums' && (
          <AlbumLibraryListScreen
            layout={albumLayout}
            downloadedOnly={downloadedOnly}
            favoritesOnly={favoritesOnly}
            contentInsetTop={contentInsetTop}
          />
        )}
        {activeSegment === 'artists' && (
          offlineMode ? (
            <View style={[styles.emptyContainer, { paddingTop: contentInsetTop }]}>
              <EmptyState
                icon="cloud-offline-outline"
                title="Not available offline"
                subtitle="Artists are not available in offline mode"
              />
            </View>
          ) : (
            <ArtistListScreen
              layout={artistLayout}
              downloadedOnly={downloadedOnly}
              favoritesOnly={favoritesOnly}
              contentInsetTop={contentInsetTop}
            />
          )
        )}
        {activeSegment === 'playlists' && (
          <PlaylistListScreen
            layout={playlistLayout}
            downloadedOnly={downloadedOnly}
            contentInsetTop={contentInsetTop}
          />
        )}
      </View>
      <View style={[styles.segmentOverlay, { top: headerHeight }]}>
        <SegmentControl segments={SEGMENTS} selected={activeSegment} onSelect={setActiveSegment} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
  },
});
