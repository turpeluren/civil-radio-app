import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumRow } from '../components/AlbumRow';
import { ArtistOptionsSheet } from '../components/ArtistOptionsSheet';
import { CachedImage } from '../components/CachedImage';
import { MoreOptionsButton } from '../components/MoreOptionsButton';
import { SectionTitle } from '../components/SectionTitle';
import { useColorExtraction } from '../hooks/useColorExtraction';
import { useTheme } from '../hooks/useTheme';
import { refreshCachedImage } from '../services/imageCacheService';
import { playTrack } from '../services/playerService';
import { artistDetailStore } from '../store/artistDetailStore';

import {
  type ArtistID3,
  type ArtistInfo2,
  type ArtistWithAlbumsID3,
  type Child,
} from '../services/subsonicService';

const HERO_PADDING = 24;
const HERO_IMAGE_SIZE = 180;
const HERO_COVER_SIZE = 600;
const HEADER_BAR_HEIGHT = 44;
const SIMILAR_THUMB_SIZE = 72;
const SONG_THUMB_SIZE = 72;

/* ------------------------------------------------------------------ */
/*  Similar artist thumbnail                                          */
/* ------------------------------------------------------------------ */

function SimilarArtistItem({
  artist,
  colors,
}: {
  artist: ArtistID3;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const router = useRouter();

  const onPress = useCallback(() => {
    router.push(`/artist/${artist.id}`);
  }, [artist.id, router]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.similarItem, pressed && styles.pressed]}
    >
      <CachedImage
        coverArtId={artist.coverArt}
        size={300}
        style={styles.similarImage}
        resizeMode="cover"
      />
      <Text
        style={[styles.similarName, { color: colors.textPrimary }]}
        numberOfLines={2}
      >
        {artist.name}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  Top song thumbnail                                                */
/* ------------------------------------------------------------------ */

function TopSongItem({
  song,
  colors,
  onPress,
}: {
  song: Child;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.songItem, pressed && styles.pressed]}>
      <CachedImage
        coverArtId={song.coverArt}
        size={300}
        style={styles.songImage}
        resizeMode="cover"
      />
      <Text
        style={[styles.songTitle, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {song.title}
      </Text>
      {song.artist && (
        <Text
          style={[styles.songArtist, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {song.artist}
        </Text>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                       */
/* ------------------------------------------------------------------ */

export function ArtistDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const cachedEntry = artistDetailStore((s) => (id ? s.artists[id] : undefined));
  const [artist, setArtist] = useState<ArtistWithAlbumsID3 | null>(cachedEntry?.artist ?? null);
  const [artistInfo, setArtistInfo] = useState<ArtistInfo2 | null>(cachedEntry?.artistInfo ?? null);
  const [topSongs, setTopSongs] = useState<Child[]>(cachedEntry?.topSongs ?? []);
  const [biography, setBiography] = useState<string | null>(cachedEntry?.biography ?? null);
  const [loading, setLoading] = useState(!cachedEntry);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const { coverBackgroundColor, gradientOpacity } = useColorExtraction(
    artist?.coverArt,
    colors.background,
  );

  /* ---- Header right: more options button ---- */
  useEffect(() => {
    if (!artist) return;
    navigation.setOptions({
      headerRight: () => (
        <MoreOptionsButton
          onPress={() => setSheetVisible(true)}
          color={colors.textPrimary}
        />
      ),
    });
  }, [artist, navigation, colors.textPrimary]);

  const handleStarChanged = useCallback(
    (artistId: string, starred: boolean) => {
      setArtist((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, starred: starred ? new Date() : undefined };
        // Keep the persisted store in sync
        const entry = artistDetailStore.getState().artists[artistId];
        if (entry) {
          artistDetailStore.setState({
            artists: {
              ...artistDetailStore.getState().artists,
              [artistId]: { ...entry, artist: updated },
            },
          });
        }
        return updated;
      });
    },
    []
  );

  /* ---- Data fetching ---- */
  const { fetchArtist } = artistDetailStore.getState();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!id) {
      setError('Missing artist id');
      if (!isRefresh) setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const minDelay = isRefresh
        ? new Promise((resolve) => setTimeout(resolve, 2000))
        : null;
      const entry = await fetchArtist(id);
      if (!entry) {
        setError('Artist not found');
        setArtist(null);
        setArtistInfo(null);
        setTopSongs([]);
        setBiography(null);
      } else {
        setArtist(entry.artist);
        setArtistInfo(entry.artistInfo);
        setTopSongs(entry.topSongs);
        setBiography(entry.biography);
        if (isRefresh && entry.artist.coverArt) {
          refreshCachedImage(entry.artist.coverArt).catch(() => {});
        }
      }
      await minDelay;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load artist');
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [id, fetchArtist]);

  // Only fetch on mount if no cached data
  useEffect(() => { if (!cachedEntry) fetchData(); }, [fetchData, cachedEntry]);

  const onRefresh = useCallback(() => fetchData(true), [fetchData]);

  /* ---- Derived values ---- */
  const gradientStart = coverBackgroundColor ?? colors.background;
  const gradientEnd = colors.background;

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  /* ---- Error state ---- */
  if (error || !artist) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error ?? 'Artist not found'}
        </Text>
      </View>
    );
  }

  const albums = artist.album ?? [];
  const similarArtists = artistInfo?.similarArtist ?? [];

  const gradientFillStyle = [
    StyleSheet.absoluteFillObject,
    { top: -insets.top, left: 0, right: 0, bottom: 0 },
  ];

  return (
    <View style={styles.container}>
      {/* Background layers */}
      <View style={[gradientFillStyle, { backgroundColor: colors.background }]} />
      <Animated.View
        style={[gradientFillStyle, { opacity: gradientOpacity }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[gradientStart, gradientEnd]}
          locations={[0, 0.5]}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          Platform.OS !== 'ios' && { paddingTop: insets.top + HEADER_BAR_HEIGHT },
        ]}
        contentInset={Platform.OS === 'ios' ? { top: insets.top + HEADER_BAR_HEIGHT } : undefined}
        contentOffset={Platform.OS === 'ios' ? { x: 0, y: -(insets.top + HEADER_BAR_HEIGHT) } : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            progressViewOffset={insets.top + HEADER_BAR_HEIGHT}
          />
        }
      >
        {/* ---- Hero ---- */}
        <View style={styles.hero}>
          <CachedImage
            coverArtId={artist.coverArt}
            size={HERO_COVER_SIZE}
            fallbackUri={artistInfo?.largeImageUrl ?? undefined}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <Text style={[styles.artistName, { color: colors.textPrimary }]}>
            {artist.name}
          </Text>
          <View style={styles.meta}>
            <Ionicons name="disc-outline" size={14} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {artist.albumCount === 1 ? '1 album' : `${artist.albumCount} albums`}
            </Text>
          </View>
        </View>

        {/* ---- Biography ---- */}
        {biography != null && biography.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="About" color={colors.label} />
            <Text
              style={[styles.bioText, { color: colors.textSecondary }]}
              numberOfLines={bioExpanded ? undefined : 4}
            >
              {biography}
            </Text>
            <Pressable
              onPress={() => setBioExpanded((prev) => !prev)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={[styles.bioToggle, { color: colors.primary }]}>
                {bioExpanded ? 'Show less' : 'Read more'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ---- Top Songs ---- */}
        {topSongs.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="Top Songs" color={colors.label} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.songList}
            >
              {topSongs.map((song, index) => (
                <TopSongItem key={`${song.id}-${index}`} song={song} colors={colors} onPress={() => playTrack(song, topSongs)} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ---- Similar Artists ---- */}
        {similarArtists.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="Similar Artists" color={colors.label} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarList}
            >
              {similarArtists.map((sa) => (
                <SimilarArtistItem key={sa.id} artist={sa} colors={colors} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ---- Albums ---- */}
        {albums.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="Albums" color={colors.label} />
            <View style={styles.albumList}>
              {albums.map((album) => (
                <AlbumRow key={album.id} album={album} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {artist && (
        <ArtistOptionsSheet
          artist={artist}
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          onStarChanged={handleStarChanged}
        />
      )}
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
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  pressed: {
    opacity: 0.8,
  },

  /* Hero */
  hero: {
    width: '100%',
    paddingTop: HERO_PADDING / 2,
    paddingBottom: HERO_PADDING,
    alignItems: 'center',
  },
  heroImage: {
    width: HERO_IMAGE_SIZE,
    height: HERO_IMAGE_SIZE,
    borderRadius: HERO_IMAGE_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  artistName: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaText: {
    fontSize: 14,
    marginLeft: 4,
  },

  /* Sections */
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },

  /* Biography */
  bioText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bioToggle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },

  /* Album list */
  albumList: {
    // AlbumRow handles its own spacing
  },

  /* Top Songs */
  songList: {
    paddingRight: 16,
    gap: 14,
  },
  songItem: {
    width: SONG_THUMB_SIZE + 16,
  },
  songImage: {
    width: SONG_THUMB_SIZE,
    height: SONG_THUMB_SIZE,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  songTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
  },
  songArtist: {
    fontSize: 11,
    marginTop: 2,
  },

  /* Similar Artists */
  similarList: {
    paddingRight: 16,
    gap: 14,
  },
  similarItem: {
    alignItems: 'center',
    width: SIMILAR_THUMB_SIZE + 16,
  },
  similarImage: {
    width: SIMILAR_THUMB_SIZE,
    height: SIMILAR_THUMB_SIZE,
    borderRadius: SIMILAR_THUMB_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  similarName: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
});
