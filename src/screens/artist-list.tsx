import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ArtistListView, type ArtistLayout } from '../components/ArtistListView';
import { useTheme } from '../hooks/useTheme';
import { albumLibraryStore } from '../store/albumLibraryStore';
import { offlineModeStore } from '../store/offlineModeStore';
import { artistLibraryStore } from '../store/artistLibraryStore';
import { favoritesStore } from '../store/favoritesStore';
import { musicCacheStore } from '../store/musicCacheStore';
import { minDelay } from '../utils/stringHelpers';

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
  const { colors } = useTheme();
  const offlineMode = offlineModeStore((s) => s.offlineMode);
  const artists = artistLibraryStore((s) => s.artists);
  const loading = artistLibraryStore((s) => s.loading);
  const error = artistLibraryStore((s) => s.error);
  const fetchAllArtists = artistLibraryStore((s) => s.fetchAllArtists);

  const cachedItems = musicCacheStore((s) => s.cachedItems);
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
        if (album.id in cachedItems && album.artistId) {
          downloadedArtistIds.add(album.artistId);
        }
      }
    }

    return artists.filter((artist) => {
      if (downloadedArtistIds && !downloadedArtistIds.has(artist.id)) return false;
      if (starredIds && !starredIds.has(artist.id)) return false;
      return true;
    });
  }, [artists, downloadedOnly, favoritesOnly, cachedItems, allAlbums, starredArtists]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (offlineMode) return;
    setRefreshing(true);
    const delay = minDelay();
    await fetchAllArtists();
    await delay;
    setRefreshing(false);
  }, [offlineMode, fetchAllArtists]);

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
