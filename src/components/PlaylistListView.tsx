import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';
import type { Playlist } from '../services/subsonicService';
import { PlaylistCard } from './PlaylistCard';
import { PlaylistRow, ROW_HEIGHT } from './PlaylistRow';

export type PlaylistLayout = 'list' | 'grid';

const GRID_COLUMNS = 2;
const GRID_GAP = 10;
const LIST_PADDING = 16;

/* ------------------------------------------------------------------ */
/*  PlaylistListView                                                  */
/* ------------------------------------------------------------------ */

export interface PlaylistListViewProps {
  /** The list of playlists to display */
  playlists: Playlist[];
  /** Display layout: row list or grid of cards */
  layout?: PlaylistLayout;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Error message to display, if any */
  error?: string | null;
  /** Called when the user pulls to refresh */
  onRefresh?: () => void;
  /** Whether a refresh is in progress (pull-to-refresh spinner) */
  refreshing?: boolean;
}

export function PlaylistListView({
  playlists,
  layout = 'list',
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
}: PlaylistListViewProps) {
  const { colors } = useTheme();

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = useMemo(
    () =>
      (screenWidth - LIST_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
      GRID_COLUMNS,
    [screenWidth]
  );

  const renderListItem = useCallback(
    ({ item }: { item: Playlist }) => <PlaylistRow playlist={item} />,
    []
  );

  const renderGridItem = useCallback(
    ({ item }: { item: Playlist }) => (
      <PlaylistCard playlist={item} width={cardWidth} />
    ),
    [cardWidth]
  );

  const keyExtractor = useCallback((item: Playlist) => item.id, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<Playlist> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const columnWrapperStyle = useMemo(() => ({ gap: GRID_GAP }), []);

  if (loading && playlists.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && playlists.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error}
        </Text>
      </View>
    );
  }

  const isGrid = layout === 'grid';

  return (
    <FlatList
      key={layout}
      data={playlists}
      renderItem={isGrid ? renderGridItem : renderListItem}
      keyExtractor={keyExtractor}
      {...(isGrid
        ? { numColumns: GRID_COLUMNS, columnWrapperStyle }
        : { getItemLayout })}
      contentContainerStyle={styles.listContent}
      windowSize={11}
      maxToRenderPerBatch={isGrid ? 12 : 20}
      initialNumToRender={isGrid ? 10 : 15}
      removeClippedSubviews
      onRefresh={onRefresh}
      refreshing={refreshing}
      ListEmptyComponent={
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No playlists
        </Text>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: LIST_PADDING,
    paddingBottom: 32,
  },
  errorText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 16,
  },
});
