import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlaylistListView, type PlaylistLayout } from '../components/PlaylistListView';
import { useTheme } from '../hooks/useTheme';
import { musicCacheStore } from '../store/musicCacheStore';
import { offlineModeStore } from '../store/offlineModeStore';
import { playlistLibraryStore } from '../store/playlistLibraryStore';
import { minDelay } from '../utils/stringHelpers';

export function PlaylistListScreen({
  layout = 'list',
  downloadedOnly = false,
  contentInsetTop = 0,
}: {
  layout?: PlaylistLayout;
  downloadedOnly?: boolean;
  contentInsetTop?: number;
}) {
  const { colors } = useTheme();
  const offlineMode = offlineModeStore((s) => s.offlineMode);
  const playlists = playlistLibraryStore((s) => s.playlists);
  const loading = playlistLibraryStore((s) => s.loading);
  const error = playlistLibraryStore((s) => s.error);
  const fetchAllPlaylists = playlistLibraryStore((s) => s.fetchAllPlaylists);

  const cachedItems = musicCacheStore((s) => s.cachedItems);

  useEffect(() => {
    if (playlists.length === 0 && !loading) {
      fetchAllPlaylists();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPlaylists = useMemo(() => {
    if (!downloadedOnly) return playlists;
    return playlists.filter((p) => p.id in cachedItems);
  }, [playlists, downloadedOnly, cachedItems]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (offlineMode) return;
    setRefreshing(true);
    const delay = minDelay();
    await fetchAllPlaylists();
    await delay;
    setRefreshing(false);
  }, [offlineMode, fetchAllPlaylists]);

  return (
    <View style={styles.container}>
      <PlaylistListView
        playlists={filteredPlaylists}
        layout={layout}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        showAlphabetScroller
        scrollToTopTrigger={`${downloadedOnly}`}
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
