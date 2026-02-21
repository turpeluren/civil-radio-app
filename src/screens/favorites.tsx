import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlbumListView } from '../components/AlbumListView';
import { ArtistListView } from '../components/ArtistListView';
import { SongListView } from '../components/SongListView';
import { useTheme } from '../hooks/useTheme';
import {
  STARRED_SONGS_ITEM_ID,
  enqueueStarredSongsDownload,
  deleteStarredSongsDownload,
  getLocalTrackUri,
} from '../services/musicCacheService';
import { minDelay } from '../utils/stringHelpers';
import { filterBarStore } from '../store/filterBarStore';
import {
  layoutPreferencesStore,
  type ItemLayout,
} from '../store/layoutPreferencesStore';
import { favoritesStore } from '../store/favoritesStore';
import { musicCacheStore } from '../store/musicCacheStore';

/* ------------------------------------------------------------------ */
/*  Segment types                                                     */
/* ------------------------------------------------------------------ */

type Segment = 'songs' | 'albums' | 'artists';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'songs', label: 'Songs' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
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
/*  FavoritesScreen                                                   */
/* ------------------------------------------------------------------ */

export function FavoritesScreen() {
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const [activeSegment, setActiveSegment] = useState<Segment>('songs');

  /* ---- Store: favorites data ---- */
  const songs = favoritesStore((s) => s.songs);
  const albums = favoritesStore((s) => s.albums);
  const artists = favoritesStore((s) => s.artists);
  const loading = favoritesStore((s) => s.loading);
  const error = favoritesStore((s) => s.error);
  const fetchStarred = favoritesStore((s) => s.fetchStarred);

  /* ---- Store: layout preferences ---- */
  const favSongLayout = layoutPreferencesStore((s) => s.favSongLayout);
  const favAlbumLayout = layoutPreferencesStore((s) => s.favAlbumLayout);
  const favArtistLayout = layoutPreferencesStore((s) => s.favArtistLayout);
  const setFavSongLayout = layoutPreferencesStore((s) => s.setFavSongLayout);
  const setFavAlbumLayout = layoutPreferencesStore((s) => s.setFavAlbumLayout);
  const setFavArtistLayout = layoutPreferencesStore((s) => s.setFavArtistLayout);

  const toggleSongLayout = useCallback(() => {
    setFavSongLayout(favSongLayout === 'list' ? 'grid' : 'list');
  }, [favSongLayout, setFavSongLayout]);

  const toggleAlbumLayout = useCallback(() => {
    setFavAlbumLayout(favAlbumLayout === 'list' ? 'grid' : 'list');
  }, [favAlbumLayout, setFavAlbumLayout]);

  const toggleArtistLayout = useCallback(() => {
    setFavArtistLayout(favArtistLayout === 'list' ? 'grid' : 'list');
  }, [favArtistLayout, setFavArtistLayout]);

  /* ---- Auto-fetch on mount ---- */
  useEffect(() => {
    if (songs.length === 0 && albums.length === 0 && artists.length === 0 && !loading) {
      fetchStarred();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Configure filter bar ---- */
  const handleDownloadStarred = useCallback(() => {
    enqueueStarredSongsDownload();
  }, []);

  const handleDeleteStarred = useCallback(() => {
    deleteStarredSongsDownload();
  }, []);

  useEffect(() => {
    if (!isFocused) return;

    const layoutMap: Record<Segment, { layout: ItemLayout; toggle: () => void }> = {
      songs: { layout: favSongLayout, toggle: toggleSongLayout },
      albums: { layout: favAlbumLayout, toggle: toggleAlbumLayout },
      artists: { layout: favArtistLayout, toggle: toggleArtistLayout },
    };

    const current = layoutMap[activeSegment];
    const store = filterBarStore.getState();
    store.setLayoutToggle({
      layout: current.layout,
      onToggle: current.toggle,
    });
    store.setHideDownloaded(activeSegment === 'artists');
    store.setHideFavorites(false);

    const showDownloadButton = activeSegment === 'songs' && songs.length > 0;
    store.setDownloadButtonConfig(
      showDownloadButton
        ? {
            itemId: STARRED_SONGS_ITEM_ID,
            type: 'playlist',
            onDownload: handleDownloadStarred,
            onDelete: handleDeleteStarred,
          }
        : null,
    );
  }, [
    isFocused,
    activeSegment,
    songs.length,
    favSongLayout,
    favAlbumLayout,
    favArtistLayout,
    toggleSongLayout,
    toggleAlbumLayout,
    toggleArtistLayout,
    handleDownloadStarred,
    handleDeleteStarred,
  ]);

  /* ---- Filter state ---- */
  const downloadedOnly = filterBarStore((s) => s.downloadedOnly);
  const cachedItems = musicCacheStore((s) => s.cachedItems);

  const filteredSongs = useMemo(() => {
    if (!downloadedOnly) return songs;
    return songs.filter((s) => getLocalTrackUri(s.id) !== null);
  }, [songs, downloadedOnly, cachedItems]);

  const filteredAlbums = useMemo(() => {
    if (!downloadedOnly) return albums;
    return albums.filter((a) => a.id in cachedItems);
  }, [albums, downloadedOnly, cachedItems]);

  const filteredArtists = useMemo(() => {
    if (!downloadedOnly) return artists;
    const downloadedArtistIds = new Set<string>();
    for (const album of albums) {
      if (album.id in cachedItems && album.artistId) {
        downloadedArtistIds.add(album.artistId);
      }
    }
    return artists.filter((a) => downloadedArtistIds.has(a.id));
  }, [artists, albums, downloadedOnly, cachedItems]);

  /* ---- Pull-to-refresh ---- */
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const delay = minDelay();
    await fetchStarred();
    await delay;
    setRefreshing(false);
  }, [fetchStarred]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SegmentControl selected={activeSegment} onSelect={setActiveSegment} />
      <View style={styles.content}>
        {activeSegment === 'songs' && (
          <SongListView
            songs={filteredSongs}
            layout={favSongLayout}
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            emptyMessage="No favorite songs yet"
            emptyIcon="heart-outline"
          />
        )}
        {activeSegment === 'albums' && (
          <AlbumListView
            albums={filteredAlbums}
            layout={favAlbumLayout}
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            emptyMessage="No favorite albums yet"
            emptyIcon="heart-outline"
          />
        )}
        {activeSegment === 'artists' && (
          <ArtistListView
            artists={filteredArtists}
            layout={favArtistLayout}
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            emptyMessage="No favorite artists yet"
            emptyIcon="heart-outline"
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
