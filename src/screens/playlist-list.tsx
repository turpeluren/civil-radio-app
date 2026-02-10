import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlaylistListView, type PlaylistLayout } from '../components/PlaylistListView';
import { useTheme } from '../hooks/useTheme';
import { playlistLibraryStore } from '../store/playlistLibraryStore';

export function PlaylistListScreen({ layout = 'list' }: { layout?: PlaylistLayout }) {
  const { colors } = useTheme();
  const playlists = playlistLibraryStore((s) => s.playlists);
  const loading = playlistLibraryStore((s) => s.loading);
  const error = playlistLibraryStore((s) => s.error);
  const fetchAllPlaylists = playlistLibraryStore((s) => s.fetchAllPlaylists);

  // Auto-fetch when mounted if the store has no data
  useEffect(() => {
    if (playlists.length === 0 && !loading) {
      fetchAllPlaylists();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(() => {
    fetchAllPlaylists();
  }, [fetchAllPlaylists]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PlaylistListView
        playlists={playlists}
        layout={layout}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
        refreshing={loading && playlists.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
