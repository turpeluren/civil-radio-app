import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AlbumListView, type AlbumLayout } from '../components/AlbumListView';
import { useTheme } from '../hooks/useTheme';
import { albumLibraryStore } from '../store/albumLibraryStore';

export function AlbumLibraryListScreen({ layout = 'list' }: { layout?: AlbumLayout }) {
  const { colors } = useTheme();
  const albums = albumLibraryStore((s) => s.albums);
  const loading = albumLibraryStore((s) => s.loading);
  const error = albumLibraryStore((s) => s.error);
  const fetchAllAlbums = albumLibraryStore((s) => s.fetchAllAlbums);

  // Auto-fetch when mounted if the store has no data
  useEffect(() => {
    if (albums.length === 0 && !loading) {
      fetchAllAlbums();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(() => {
    fetchAllAlbums();
  }, [fetchAllAlbums]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AlbumListView
        albums={albums}
        layout={layout}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
        refreshing={loading && albums.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
