import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { EmptyState } from './EmptyState';
import { playTrack } from '../services/playerService';
import type { Child } from '../services/subsonicService';
import { SongCard } from './SongCard';
import { SongRow } from './SongRow';
import { closeOpenRow } from './SwipeableRow';

export type SongLayout = 'list' | 'grid';

const GRID_COLUMNS = 2;
const GRID_GAP = 10;
const LIST_PADDING = 16;

/* ------------------------------------------------------------------ */
/*  SongListView                                                      */
/* ------------------------------------------------------------------ */

export interface SongListViewProps {
  /** The list of songs to display */
  songs: Child[];
  /** Display layout: row list or grid of cards */
  layout?: SongLayout;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Error message to display, if any */
  error?: string | null;
  /** Called when the user pulls to refresh */
  onRefresh?: () => void;
  /** Whether a refresh is in progress (pull-to-refresh spinner) */
  refreshing?: boolean;
  /** Custom empty-state message */
  emptyMessage?: string;
  /** Custom empty-state subtitle */
  emptySubtitle?: string;
  /** Optional Ionicons icon name for empty state */
  emptyIcon?: string;
}

export function SongListView({
  songs,
  layout = 'list',
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
  emptyMessage = 'No songs found',
  emptySubtitle = 'Try adjusting your filters, or pull to refresh',
  emptyIcon,
}: SongListViewProps) {
  const { colors } = useTheme();

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = useMemo(
    () =>
      (screenWidth - LIST_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
      GRID_COLUMNS,
    [screenWidth]
  );

  const renderListItem = useCallback(
    ({ item }: { item: Child }) => (
      <SongRow song={item} onPress={() => playTrack(item, songs)} />
    ),
    [songs]
  );

  const renderGridItem = useCallback(
    ({ item, index }: { item: Child; index: number }) => {
      const isLeftColumn = index % GRID_COLUMNS === 0;
      return (
        <View
          style={{
            flex: 1,
            paddingLeft: isLeftColumn ? 0 : GRID_GAP / 2,
            paddingRight: isLeftColumn ? GRID_GAP / 2 : 0,
          }}
        >
          <SongCard song={item} width={cardWidth} onPress={() => playTrack(item, songs)} />
        </View>
      );
    },
    [cardWidth, songs]
  );

  const keyExtractor = useCallback((item: Child) => item.id, []);

  const EmptyComponent = useMemo(
    () => (
      <EmptyState
        icon={(emptyIcon as any) ?? 'musical-notes-outline'}
        title={emptyMessage}
        subtitle={emptySubtitle}
      />
    ),
    [emptyIcon, emptyMessage, emptySubtitle]
  );

  if (loading && songs.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && songs.length === 0) {
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
    <FlashList
      key={layout}
      data={songs}
      renderItem={isGrid ? renderGridItem : renderListItem}
      keyExtractor={keyExtractor}
      onScrollBeginDrag={closeOpenRow}
      numColumns={isGrid ? GRID_COLUMNS : 1}
      contentContainerStyle={[
        styles.listContent,
        songs.length === 0 && styles.emptyListContent,
      ]}
      onRefresh={onRefresh}
      refreshing={refreshing}
      ListEmptyComponent={EmptyComponent}
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
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
});
