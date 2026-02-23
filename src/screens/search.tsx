import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AlbumRow } from '../components/AlbumRow';
import { EmptyState } from '../components/EmptyState';
import { ArtistRow } from '../components/ArtistRow';
import { SongRow } from '../components/SongRow';
import { useTheme } from '../hooks/useTheme';
import { getLocalTrackUri } from '../services/musicCacheService';
import { playTrack } from '../services/playerService';
import { minDelay } from '../utils/stringHelpers';
import {
  type AlbumID3,
  type ArtistID3,
  type Child,
} from '../services/subsonicService';
import { favoritesStore } from '../store/favoritesStore';
import { filterBarStore } from '../store/filterBarStore';
import { musicCacheStore } from '../store/musicCacheStore';
import { searchStore } from '../store/searchStore';

/* ------------------------------------------------------------------ */
/*  Section data types                                                */
/* ------------------------------------------------------------------ */

type SectionItem =
  | { type: 'artist'; data: ArtistID3 }
  | { type: 'album'; data: AlbumID3 }
  | { type: 'song'; data: Child };

interface ResultSection {
  title: string;
  data: SectionItem[];
}

/* ------------------------------------------------------------------ */
/*  SearchScreen                                                      */
/* ------------------------------------------------------------------ */

export function SearchScreen() {
  const { colors } = useTheme();
  const isFocused = useIsFocused();

  const query = searchStore((s) => s.query);
  const results = searchStore((s) => s.results);
  const loading = searchStore((s) => s.loading);
  const performSearch = searchStore((s) => s.performSearch);

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
  const starredSongs = favoritesStore((s) => s.songs);
  const starredAlbums = favoritesStore((s) => s.albums);
  const starredArtists = favoritesStore((s) => s.artists);

  const filtered = useMemo(() => {
    let artists = results.artists;
    let albums = results.albums;
    let songs = results.songs;

    if (downloadedOnly) {
      albums = albums.filter((a) => a.id in cachedItems);
      songs = songs.filter((s) => getLocalTrackUri(s.id) !== null);
      const downloadedArtistIds = new Set<string>();
      for (const album of albums) {
        if (album.artistId) downloadedArtistIds.add(album.artistId);
      }
      artists = artists.filter((a) => downloadedArtistIds.has(a.id));
    }

    if (favoritesOnly) {
      const starredSongIds = new Set(starredSongs.map((s) => s.id));
      const starredAlbumIds = new Set(starredAlbums.map((a) => a.id));
      const starredArtistIds = new Set(starredArtists.map((a) => a.id));
      artists = artists.filter((a) => starredArtistIds.has(a.id));
      albums = albums.filter((a) => starredAlbumIds.has(a.id));
      songs = songs.filter((s) => starredSongIds.has(s.id));
    }

    return { artists, albums, songs };
  }, [
    results,
    downloadedOnly,
    favoritesOnly,
    cachedItems,
    starredSongs,
    starredAlbums,
    starredArtists,
  ]);

  const hasResults =
    filtered.artists.length > 0 ||
    filtered.albums.length > 0 ||
    filtered.songs.length > 0;

  const sections: ResultSection[] = [];
  if (filtered.artists.length > 0) {
    sections.push({
      title: 'Artists',
      data: filtered.artists.map((a) => ({ type: 'artist' as const, data: a })),
    });
  }
  if (filtered.albums.length > 0) {
    sections.push({
      title: 'Albums',
      data: filtered.albums.map((a) => ({ type: 'album' as const, data: a })),
    });
  }
  if (filtered.songs.length > 0) {
    sections.push({
      title: 'Songs',
      data: filtered.songs.map((s) => ({ type: 'song' as const, data: s })),
    });
  }

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!query.trim()) return;
    setRefreshing(true);
    const delay = minDelay();
    await performSearch();
    await delay;
    setRefreshing(false);
  }, [query, performSearch]);

  const renderItem = useCallback(
    ({ item }: { item: SectionItem }) => {
      switch (item.type) {
        case 'artist':
          return <ArtistRow artist={item.data} />;
        case 'album':
          return <AlbumRow album={item.data} />;
        case 'song':
          return (
            <SongRow
              song={item.data}
              onPress={() => playTrack(item.data, filtered.songs)}
            />
          );
      }
    },
    [filtered.songs]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ResultSection }) => (
      <Text style={[styles.sectionTitle, { color: colors.label }]}>
        {section.title}
      </Text>
    ),
    [colors.label]
  );

  const keyExtractor = useCallback(
    (item: SectionItem, index: number) => `${item.type}-${item.data.id}-${index}`,
    []
  );

  if (!query.trim() || (!hasResults && !loading)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="search-outline"
          title={!query.trim() ? 'Search for music' : 'No results found'}
          subtitle={!query.trim() ? 'Find songs, albums, and artists' : `No results for "${query}"`}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
});
