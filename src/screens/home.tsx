import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AlbumCard } from '../components/AlbumCard';
import { PlaylistCard } from '../components/PlaylistCard';
import { useTheme } from '../hooks/useTheme';
import type { AlbumID3, Playlist } from '../services/subsonicService';
import { albumLibraryStore } from '../store/albumLibraryStore';
import {
  albumListsStore,
  type AlbumListType,
} from '../store/albumListsStore';
import { favoritesStore } from '../store/favoritesStore';
import { filterBarStore } from '../store/filterBarStore';
import { musicCacheStore } from '../store/musicCacheStore';
import { playlistLibraryStore } from '../store/playlistLibraryStore';

const CARD_WIDTH = 150;
const CARD_GAP = 12;

const SECTION_CONFIG: Record<
  AlbumListType,
  { title: string; emptyMessage: string; refresh: () => Promise<void> }
> = {
  recentlyAdded: {
    title: 'Recently Added',
    emptyMessage: 'No recent albums',
    refresh: () => albumListsStore.getState().refreshRecentlyAdded(),
  },
  recentlyPlayed: {
    title: 'Recently Played',
    emptyMessage: 'No recently played albums',
    refresh: () => albumListsStore.getState().refreshRecentlyPlayed(),
  },
  frequentlyPlayed: {
    title: 'Frequently Played',
    emptyMessage: 'No frequently played albums',
    refresh: () => albumListsStore.getState().refreshFrequentlyPlayed(),
  },
  randomSelection: {
    title: 'Random Selection',
    emptyMessage: 'No albums',
    refresh: () => albumListsStore.getState().refreshRandomSelection(),
  },
};

function AlbumSection({
  listType,
  albums,
  colors,
}: {
  listType: AlbumListType;
  albums: AlbumID3[];
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const router = useRouter();
  const config = SECTION_CONFIG[listType];
  const renderItem = useCallback(
    ({ item }: { item: AlbumID3 }) => (
      <AlbumCard album={item} width={CARD_WIDTH} />
    ),
    []
  );
  const keyExtractor = useCallback((item: AlbumID3) => item.id, []);
  const onRefresh = useCallback(() => {
    config.refresh();
  }, [listType]);
  const onSeeMore = useCallback(() => {
    router.push({ pathname: '/album-list', params: { type: listType } });
  }, [listType, router]);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {config.title}
        </Text>
        <View style={styles.sectionHeaderActions}>
          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="refresh"
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
          <Pressable
            onPress={onSeeMore}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>
      {albums.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {config.emptyMessage}
        </Text>
      ) : (
        <FlashList
          data={albums}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        />
      )}
    </View>
  );
}

function DownloadedAlbumSection({
  albums,
  colors,
}: {
  albums: AlbumID3[];
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const renderItem = useCallback(
    ({ item }: { item: AlbumID3 }) => (
      <AlbumCard album={item} width={CARD_WIDTH} />
    ),
    []
  );
  const keyExtractor = useCallback((item: AlbumID3) => item.id, []);

  if (albums.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 16 }]}>
        Downloaded Albums
      </Text>
      <FlashList
        data={albums}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
      />
    </View>
  );
}

function PlaylistSection({
  playlists,
  colors,
}: {
  playlists: Playlist[];
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const renderItem = useCallback(
    ({ item }: { item: Playlist }) => (
      <PlaylistCard playlist={item} width={CARD_WIDTH} />
    ),
    []
  );
  const keyExtractor = useCallback((item: Playlist) => item.id, []);

  if (playlists.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 16 }]}>
        Downloaded Playlists
      </Text>
      <FlashList
        data={playlists}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
      />
    </View>
  );
}

const SECTION_ORDER: AlbumListType[] = [
  'recentlyAdded',
  'recentlyPlayed',
  'frequentlyPlayed',
  'randomSelection',
];

export function HomeScreen() {
  const { colors } = useTheme();
  const isFocused = useIsFocused();

  const recentlyAdded = albumListsStore((s) => s.recentlyAdded);
  const recentlyPlayed = albumListsStore((s) => s.recentlyPlayed);
  const frequentlyPlayed = albumListsStore((s) => s.frequentlyPlayed);
  const randomSelection = albumListsStore((s) => s.randomSelection);

  useEffect(() => {
    if (!isFocused) return;
    const store = filterBarStore.getState();
    store.setLayoutToggle(null);
    store.setDownloadButtonConfig(null);
    store.setHideDownloaded(false);
    store.setHideFavorites(false);
  }, [isFocused]);

  const downloadedOnly = filterBarStore((s) => s.downloadedOnly);
  const favoritesOnly = filterBarStore((s) => s.favoritesOnly);
  const cachedItems = musicCacheStore((s) => s.cachedItems);
  const starredAlbums = favoritesStore((s) => s.albums);

  const allLibraryAlbums = albumLibraryStore((s) => s.albums);
  const allPlaylists = playlistLibraryStore((s) => s.playlists);

  const allSections: Record<AlbumListType, AlbumID3[]> = useMemo(
    () => ({
      recentlyAdded,
      recentlyPlayed,
      frequentlyPlayed,
      randomSelection,
    }),
    [recentlyAdded, recentlyPlayed, frequentlyPlayed, randomSelection],
  );

  const filteredSections = useMemo(() => {
    if (!downloadedOnly && !favoritesOnly) return allSections;

    const starredIds = favoritesOnly
      ? new Set(starredAlbums.map((a) => a.id))
      : null;

    const result: Record<string, AlbumID3[]> = {};
    for (const key of SECTION_ORDER) {
      result[key] = allSections[key].filter((album) => {
        if (downloadedOnly && !(album.id in cachedItems)) return false;
        if (starredIds && !starredIds.has(album.id)) return false;
        return true;
      });
    }
    return result as Record<AlbumListType, AlbumID3[]>;
  }, [allSections, downloadedOnly, favoritesOnly, cachedItems, starredAlbums]);

  const hasAnyFilters = downloadedOnly || favoritesOnly;

  const downloadedAlbums = useMemo(() => {
    if (!downloadedOnly) return [];
    return allLibraryAlbums.filter((a) => a.id in cachedItems);
  }, [downloadedOnly, allLibraryAlbums, cachedItems]);

  const downloadedPlaylists = useMemo(() => {
    if (!downloadedOnly) return [];
    return allPlaylists.filter((p) => p.id in cachedItems);
  }, [downloadedOnly, allPlaylists, cachedItems]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {downloadedOnly && (
          <>
            <DownloadedAlbumSection albums={downloadedAlbums} colors={colors} />
            <PlaylistSection playlists={downloadedPlaylists} colors={colors} />
          </>
        )}
        {SECTION_ORDER.map((key) => {
          const sectionAlbums = filteredSections[key];
          if (hasAnyFilters && sectionAlbums.length === 0) return null;
          return (
            <AlbumSection
              key={key}
              listType={key}
              albums={sectionAlbums}
              colors={colors}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 4,
  },
  iconButtonPressed: {
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 16,
  },
  horizontalList: {
    paddingRight: 16,
  },
});
