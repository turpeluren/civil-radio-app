import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { getCoverArtUrl, type AlbumID3 } from '../services/subsonicService';

const COVER_SIZE = 300;
const ROW_HEIGHT = 80; // padding (12*2) + image (56) = 80

/* ------------------------------------------------------------------ */
/*  AlbumRow                                                          */
/* ------------------------------------------------------------------ */

const AlbumRow = memo(function AlbumRow({ album }: { album: AlbumID3 }) {
  const { colors } = useTheme();
  const router = useRouter();
  const uri = getCoverArtUrl(album.coverArt ?? '', COVER_SIZE) ?? undefined;

  const onPress = useCallback(() => {
    router.push(`/album/${album.id}`);
  }, [album.id, router]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card },
        pressed && styles.rowPressed,
      ]}
    >
      <Image source={{ uri }} style={styles.rowCover} resizeMode="cover" />
      <View style={styles.rowText}>
        <Text
          style={[styles.rowAlbumName, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {album.name}
        </Text>
        <Text
          style={[styles.rowArtistName, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {album.artist ?? 'Unknown Artist'}
        </Text>
      </View>
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/*  AlbumListView                                                     */
/* ------------------------------------------------------------------ */

export interface AlbumListViewProps {
  /** The list of albums to display */
  albums: AlbumID3[];
  /** Whether data is currently loading */
  loading?: boolean;
  /** Error message to display, if any */
  error?: string | null;
  /** Called when the user pulls to refresh */
  onRefresh?: () => void;
  /** Whether a refresh is in progress (pull-to-refresh spinner) */
  refreshing?: boolean;
}

export function AlbumListView({
  albums,
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
}: AlbumListViewProps) {
  const { colors } = useTheme();

  const renderItem = useCallback(
    ({ item }: { item: AlbumID3 }) => <AlbumRow album={item} />,
    []
  );

  const keyExtractor = useCallback((item: AlbumID3) => item.id, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<AlbumID3> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  if (loading && albums.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && albums.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={albums}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      contentContainerStyle={styles.listContent}
      windowSize={11}
      maxToRenderPerBatch={20}
      initialNumToRender={15}
      removeClippedSubviews
      onRefresh={onRefresh}
      refreshing={refreshing}
      ListEmptyComponent={
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No albums
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
    padding: 16,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowCover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
  },
  rowAlbumName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowArtistName: {
    fontSize: 14,
    marginTop: 2,
  },
  errorText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 16,
  },
});
