import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AlbumListView, type AlbumLayout } from '../components/AlbumListView';
import { useTheme } from '../hooks/useTheme';
import { albumLibraryStore } from '../store/albumLibraryStore';
import { favoritesStore } from '../store/favoritesStore';
import { musicCacheStore } from '../store/musicCacheStore';
import { minDelay } from '../utils/stringHelpers';

export function AlbumLibraryListScreen({
  layout = 'list',
  downloadedOnly = false,
  favoritesOnly = false,
}: {
  layout?: AlbumLayout;
  downloadedOnly?: boolean;
  favoritesOnly?: boolean;
}) {
  const { colors } = useTheme();
  const albums = albumLibraryStore((s) => s.albums);
  const loading = albumLibraryStore((s) => s.loading);
  const error = albumLibraryStore((s) => s.error);
  const fetchAllAlbums = albumLibraryStore((s) => s.fetchAllAlbums);

  const cachedItems = musicCacheStore((s) => s.cachedItems);
  const starredAlbums = favoritesStore((s) => s.albums);

  useEffect(() => {
    if (albums.length === 0 && !loading) {
      fetchAllAlbums();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredAlbums = useMemo(() => {
    if (!downloadedOnly && !favoritesOnly) return albums;

    const starredIds = favoritesOnly
      ? new Set(starredAlbums.map((a) => a.id))
      : null;

    return albums.filter((album) => {
      if (downloadedOnly && !(album.id in cachedItems)) return false;
      if (starredIds && !starredIds.has(album.id)) return false;
      return true;
    });
  }, [albums, downloadedOnly, favoritesOnly, cachedItems, starredAlbums]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const delay = minDelay();
    await fetchAllAlbums();
    await delay;
    setRefreshing(false);
  }, [fetchAllAlbums]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AlbumListView
        albums={filteredAlbums}
        layout={layout}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        showAlphabetScroller
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
