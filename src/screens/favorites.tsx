import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AlbumListView } from '../components/AlbumListView';
import { EmptyState } from '../components/EmptyState';
import { ArtistListView } from '../components/ArtistListView';
import { SegmentControl } from '../components/SegmentControl';
import { SongListView } from '../components/SongListView';
import {
  STARRED_SONGS_ITEM_ID,
  enqueueStarredSongsDownload,
  deleteStarredSongsDownload,
  getLocalTrackUri,
} from '../services/musicCacheService';
import { minDelay } from '../utils/stringHelpers';
import { filterBarStore } from '../store/filterBarStore';
import { offlineModeStore } from '../store/offlineModeStore';
import {
  layoutPreferencesStore,
  type ItemLayout,
} from '../store/layoutPreferencesStore';
import { favoritesStore } from '../store/favoritesStore';
import { musicCacheStore } from '../store/musicCacheStore';
import { searchStore } from '../store/searchStore';

type FavoritesSegment = 'songs' | 'albums' | 'artists';

const SEGMENTS = [
  { key: 'songs', label: 'Songs' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
] as const;

/* ------------------------------------------------------------------ */
/*  FavoritesScreen                                                   */
/* ------------------------------------------------------------------ */

export function FavoritesScreen() {
  const isFocused = useIsFocused();
  const headerHeight = searchStore((s) => s.headerHeight);
  const [activeSegment, setActiveSegment] = useState<FavoritesSegment>('songs');

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

  /* ---- Filter state ---- */
  const offlineMode = offlineModeStore((s) => s.offlineMode);
  const downloadedOnly = filterBarStore((s) => s.downloadedOnly);
  const cachedItems = musicCacheStore((s) => s.cachedItems);
  const starredSongsDownloaded = STARRED_SONGS_ITEM_ID in cachedItems;

  /* ---- Configure filter bar ---- */
  const handleDownloadStarred = useCallback(() => {
    enqueueStarredSongsDownload();
  }, []);

  const handleDeleteStarred = useCallback(() => {
    deleteStarredSongsDownload();
  }, []);

  useEffect(() => {
    if (!isFocused) return;

    const layoutMap: Record<FavoritesSegment, { layout: ItemLayout; toggle: () => void }> = {
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

    const showDownloadButton =
      activeSegment === 'songs' && songs.length > 0 && (!offlineMode || starredSongsDownloaded);
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
    offlineMode,
    cachedItems,
    favSongLayout,
    favAlbumLayout,
    favArtistLayout,
    toggleSongLayout,
    toggleAlbumLayout,
    toggleArtistLayout,
    handleDownloadStarred,
    handleDeleteStarred,
  ]);

  const filteredSongs = useMemo(() => {
    if (!downloadedOnly) return songs;
    if (!starredSongsDownloaded) return [];
    return songs.filter((s) => getLocalTrackUri(s.id) !== null);
  }, [songs, downloadedOnly, starredSongsDownloaded, cachedItems]);

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
    if (offlineMode) return;
    setRefreshing(true);
    const delay = minDelay();
    await fetchStarred();
    await delay;
    setRefreshing(false);
  }, [offlineMode, fetchStarred]);

  const segmentHeight = 52;
  const contentInsetTop = headerHeight + segmentHeight;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {activeSegment === 'songs' && (
          <SongListView
            songs={filteredSongs}
            layout={favSongLayout}
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            emptyMessage={starredSongsDownloaded === false && offlineMode
              ? 'Not available offline'
              : 'No favorite songs yet'}
            emptySubtitle={starredSongsDownloaded === false && offlineMode
              ? 'Download your favorite songs to access them in offline mode'
              : 'Star songs you love and they will appear here, or check your filters'}
            emptyIcon={starredSongsDownloaded === false && offlineMode
              ? 'cloud-offline-outline'
              : 'heart-outline'}
            scrollToTopTrigger={`${downloadedOnly}`}
            contentInsetTop={contentInsetTop}
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
            emptySubtitle="Star albums you love and they will appear here, or check your filters"
            emptyIcon="heart-outline"
            scrollToTopTrigger={`${downloadedOnly}`}
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
            <ArtistListView
              artists={filteredArtists}
              layout={favArtistLayout}
              loading={loading}
              error={error}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              emptyMessage="No favorite artists yet"
              emptySubtitle="Star artists you love and they will appear here, or check your filters"
              emptyIcon="heart-outline"
              scrollToTopTrigger={`${downloadedOnly}`}
              contentInsetTop={contentInsetTop}
            />
          )
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
