import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ArtistListView, type ArtistLayout } from '../components/ArtistListView';
import { onPullToRefresh } from '../services/dataSyncService';
import { albumLibraryStore } from '../store/albumLibraryStore';
import { artistLibraryStore } from '../store/artistLibraryStore';
import { favoritesStore } from '../store/favoritesStore';
import { layoutPreferencesStore } from '../store/layoutPreferencesStore';
import { musicCacheStore } from '../store/musicCacheStore';
import { albumPassesDownloadedFilter } from '../store/persistence/cachedItemHelpers';

export function ArtistListScreen({
  layout = 'list',
  downloadedOnly = false,
  favoritesOnly = false,
  contentInsetTop = 0,
}: {
  layout?: ArtistLayout;
  downloadedOnly?: boolean;
  favoritesOnly?: boolean;
  contentInsetTop?: number;
}) {
  const artists = artistLibraryStore((s) => s.artists);
  const loading = artistLibraryStore((s) => s.loading);
  const error = artistLibraryStore((s) => s.error);
  const fetchAllArtists = artistLibraryStore((s) => s.fetchAllArtists);

  const cachedItems = musicCacheStore((s) => s.cachedItems);
  const includePartial = layoutPreferencesStore((s) => s.includePartialInDownloadedFilter);
  const allAlbums = albumLibraryStore((s) => s.albums);
  const starredArtists = favoritesStore((s) => s.artists);

  useEffect(() => {
    if (artists.length === 0 && !loading) {
      fetchAllArtists();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredArtists = useMemo(() => {
    if (!downloadedOnly && !favoritesOnly) return artists;

    const starredIds = favoritesOnly
      ? new Set(starredArtists.map((a) => a.id))
      : null;

    let downloadedArtistIds: Set<string> | null = null;
    if (downloadedOnly) {
      downloadedArtistIds = new Set<string>();
      for (const album of allAlbums) {
        if (albumPassesDownloadedFilter(album, cachedItems, includePartial) && album.artistId) {
          downloadedArtistIds.add(album.artistId);
        }
      }
    }

    return artists.filter((artist) => {
      if (downloadedArtistIds && !downloadedArtistIds.has(artist.id)) return false;
      if (starredIds && !starredIds.has(artist.id)) return false;
      return true;
    });
  }, [artists, downloadedOnly, favoritesOnly, cachedItems, allAlbums, starredArtists, includePartial]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onPullToRefresh('artists');
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <ArtistListView
        artists={filteredArtists}
        layout={layout}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        showAlphabetScroller
        scrollToTopTrigger={`${downloadedOnly}:${favoritesOnly}`}
        contentInsetTop={contentInsetTop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
