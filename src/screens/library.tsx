import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { useTheme } from '../hooks/useTheme';
import { filterBarStore } from '../store/filterBarStore';
import { offlineModeStore } from '../store/offlineModeStore';
import {
  layoutPreferencesStore,
  type ItemLayout,
} from '../store/layoutPreferencesStore';
import { AlbumLibraryListScreen } from './album-library-list';
import { ArtistListScreen } from './artist-list';
import { PlaylistListScreen } from './playlist-list';

/* ------------------------------------------------------------------ */
/*  Segment types                                                     */
/* ------------------------------------------------------------------ */

type Segment = 'albums' | 'artists' | 'playlists';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
  { key: 'playlists', label: 'Playlists' },
];

/* ------------------------------------------------------------------ */
/*  SegmentControl                                                    */
/* ------------------------------------------------------------------ */

function SegmentControl({
  selected,
  onSelect,
}: {
  selected: Segment;
  onSelect: (segment: Segment) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.segmentContainer, { backgroundColor: colors.inputBg }]}>
      {SEGMENTS.map(({ key, label }) => {
        const isActive = selected === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={[
              styles.segmentButton,
              isActive && [styles.segmentButtonActive, { backgroundColor: colors.card }],
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: isActive ? colors.textPrimary : colors.textSecondary },
                isActive && styles.segmentLabelActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  LibraryScreen                                                     */
/* ------------------------------------------------------------------ */

export function LibraryScreen() {
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const [activeSegment, setActiveSegment] = useState<Segment>('albums');

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

    const layoutMap: Record<Segment, { layout: ItemLayout; toggle: () => void }> = {
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SegmentControl selected={activeSegment} onSelect={setActiveSegment} />
      <View style={styles.content}>
        {activeSegment === 'albums' && (
          <AlbumLibraryListScreen
            layout={albumLayout}
            downloadedOnly={downloadedOnly}
            favoritesOnly={favoritesOnly}
          />
        )}
        {activeSegment === 'artists' && (
          offlineMode ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Not available offline"
              subtitle="Artists are not available in offline mode"
            />
          ) : (
            <ArtistListScreen
              layout={artistLayout}
              downloadedOnly={downloadedOnly}
              favoritesOnly={favoritesOnly}
            />
          )
        )}
        {activeSegment === 'playlists' && (
          <PlaylistListScreen
            layout={playlistLayout}
            downloadedOnly={downloadedOnly}
          />
        )}
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
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  segmentLabelActive: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
