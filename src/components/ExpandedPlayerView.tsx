/**
 * ExpandedPlayerView — full-screen immersive player for tablet landscape.
 *
 * Apple Music iPad-inspired layout:
 * - Left column (~45%): large cover art, track info, progress bar, transport controls
 * - Right column (~55%): queue list or lyrics placeholder with toggle
 * - Extracted-color gradient background
 * - Animated entrance/exit driven by `expandProgress` (0 = hidden, 1 = fully expanded)
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CachedImage } from './CachedImage';
import { MarqueeText } from './MarqueeText';
import { MoreOptionsButton } from './MoreOptionsButton';
import { PlaybackRateButton } from './PlaybackRateButton';
import { PlayerProgressBar } from './PlayerProgressBar';
import { QueueItemRow } from './QueueItemRow';
import { RepeatButton } from './RepeatButton';
import { ShuffleButton } from './ShuffleButton';
import { SkipIntervalButton } from './SkipIntervalButton';
import { ThemedAlert } from './ThemedAlert';
import { closeOpenRow } from './SwipeableRow';
import { useCanSkip } from '../hooks/useCanSkip';
import { useColorExtraction } from '../hooks/useColorExtraction';
import { mixHexColors } from '../utils/colors';
import { useIsStarred } from '../hooks/useIsStarred';
import { useTheme } from '../hooks/useTheme';
import { useThemedAlert } from '../hooks/useThemedAlert';
import { toggleStar } from '../services/moreOptionsService';
import {
  clearQueue,
  retryPlayback,
  seekTo,
  shuffleQueue,
  skipToNext,
  skipToPrevious,
  skipToTrack,
  togglePlayPause,
} from '../services/playerService';
import { sanitizeBiographyText } from '../utils/formatters';
import { getGenreNames } from '../utils/genreHelpers';
import { minDelay } from '../utils/stringHelpers';
import { type Child } from '../services/subsonicService';
import { albumInfoStore } from '../store/albumInfoStore';
import { playbackSettingsStore } from '../store/playbackSettingsStore';
import { createShareStore } from '../store/createShareStore';
import { moreOptionsStore } from '../store/moreOptionsStore';
import { offlineModeStore } from '../store/offlineModeStore';
import { playerStore } from '../store/playerStore';
import { tabletLayoutStore } from '../store/tabletLayoutStore';

const HERO_COVER_SIZE = 600;
const CONTENT_PADDING = 40;
const COLUMN_GAP = 32;

interface ExpandedPlayerViewProps {
  expandProgress: SharedValue<number>;
}

export function ExpandedPlayerView({
  expandProgress,
}: ExpandedPlayerViewProps) {
  const { colors } = useTheme();
  const { alert, alertProps } = useThemedAlert();
  const insets = useSafeAreaInsets();
  const currentTrack = playerStore((s) => s.currentTrack);
  const currentTrackIndex = playerStore((s) => s.currentTrackIndex);
  const queue = playerStore((s) => s.queue);
  const playbackState = playerStore((s) => s.playbackState);
  const position = playerStore((s) => s.position);
  const duration = playerStore((s) => s.duration);
  const bufferedPosition = playerStore((s) => s.bufferedPosition);
  const error = playerStore((s) => s.error);
  const retrying = playerStore((s) => s.retrying);

  const showSkipInterval = playbackSettingsStore((s) => s.showSkipIntervalButtons);
  const { canSkipNext, canSkipPrevious } = useCanSkip();

  const isPlaying =
    playbackState === 'playing' || playbackState === 'buffering';
  const isBuffering =
    playbackState === 'buffering' || playbackState === 'loading';

  // Own color extraction for gradient background
  const { coverBackgroundColor, gradientOpacity: extractedGradientOpacity } =
    useColorExtraction(currentTrack?.coverArt, colors.background);

  // Darken the extracted color for a richer, moodier full-screen background
  const gradientStart = coverBackgroundColor
    ? mixHexColors(coverBackgroundColor, '#000000', 0.4)
    : colors.background;
  const gradientEnd = mixHexColors(colors.background, '#000000', 0.15);

  // Right panel mode: queue (default), lyrics placeholder, or album info
  const [rightPanelMode, setRightPanelMode] = useState<'queue' | 'lyrics' | 'info'>('queue');

  // Album info state
  const albumId = currentTrack?.albumId ?? null;
  const albumInfoEntry = albumInfoStore((s) => albumId ? s.entries[albumId] : undefined);
  const albumInfoLoading = albumInfoStore((s) => albumId ? (s.loading[albumId] ?? false) : false);
  const fetchAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (rightPanelMode !== 'info' || !albumId || albumInfoEntry || albumInfoLoading) return;
    if (fetchAttemptedRef.current === albumId) return;
    fetchAttemptedRef.current = albumId;
    albumInfoStore.getState().fetchAlbumInfo(
      albumId,
      currentTrack?.artist ?? undefined,
      currentTrack?.album ?? undefined,
    );
  }, [rightPanelMode, albumId, albumInfoEntry, albumInfoLoading, currentTrack?.artist, currentTrack?.album]);

  // Reset fetch guard when album changes
  useEffect(() => {
    fetchAttemptedRef.current = null;
  }, [albumId]);

  const sanitizedNotes = useMemo(() => {
    // Prefer server notes, fall back to Wikipedia-enriched notes
    const serverNotes = albumInfoEntry?.albumInfo.notes;
    if (serverNotes) {
      const sanitized = sanitizeBiographyText(serverNotes);
      if (sanitized) return sanitized;
    }
    return albumInfoEntry?.enrichedNotes ?? null;
  }, [albumInfoEntry?.albumInfo.notes, albumInfoEntry?.enrichedNotes]);

  const notesAttributionUrl = albumInfoEntry?.enrichedNotesUrl ?? null;

  // Pull-to-refresh for album info panel
  const [albumInfoRefreshing, setAlbumInfoRefreshing] = useState(false);
  const handleRefreshAlbumInfo = useCallback(async () => {
    if (!albumId) return;
    setAlbumInfoRefreshing(true);
    const delay = minDelay();
    // Clear existing entry so a fresh fetch is triggered
    const { [albumId]: _, ...rest } = albumInfoStore.getState().entries;
    albumInfoStore.setState({ entries: rest });
    fetchAttemptedRef.current = null;
    await albumInfoStore.getState().fetchAlbumInfo(
      albumId,
      currentTrack?.artist ?? undefined,
      currentTrack?.album ?? undefined,
    );
    await delay;
    setAlbumInfoRefreshing(false);
  }, [albumId, currentTrack?.artist, currentTrack?.album]);

  // Measure the art area so cover art fills available height
  const [artMaxSize, setArtMaxSize] = useState(0);
  const handleArtAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArtMaxSize(Math.floor(Math.min(width, height)));
  }, []);

  // --- Animated styles driven by expandProgress ---

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
    pointerEvents: expandProgress.value > 0.05 ? 'auto' as const : 'none' as const,
  }));

  const gradientAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.5], [0, 1], Extrapolation.CLAMP)
      * extractedGradientOpacity.value,
  }));

  const coverStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(expandProgress.value, [0.1, 1], [0.85, 1], Extrapolation.CLAMP),
    }],
    opacity: interpolate(expandProgress.value, [0.1, 0.5], [0, 1], Extrapolation.CLAMP),
  }));

  const toolbarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0.3, 0.7], [0, 1], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(expandProgress.value, [0.3, 0.7], [-15, 0], Extrapolation.CLAMP),
    }],
  }));

  const leftColumnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0.2, 0.6], [0, 1], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(expandProgress.value, [0.2, 0.6], [20, 0], Extrapolation.CLAMP),
    }],
  }));

  const rightColumnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0.35, 0.8], [0, 1], Extrapolation.CLAMP),
    transform: [{
      translateX: interpolate(expandProgress.value, [0.35, 0.8], [30, 0], Extrapolation.CLAMP),
    }],
  }));

  // --- Callbacks ---

  const handleCollapse = useCallback(() => {
    tabletLayoutStore.getState().setPlayerExpanded(false);
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    seekTo(seconds);
  }, []);

  const handleQueueItemPress = useCallback((index: number) => {
    skipToTrack(index);
  }, []);

  const handleQueueItemLongPress = useCallback((track: Child) => {
    moreOptionsStore.getState().show({ type: 'song', item: track }, 'playerexpanded');
  }, []);

  const handleClearQueue = useCallback(() => {
    alert(
      'Clear Queue',
      'This will stop playback and clear the queue.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearQueue },
      ],
    );
  }, []);

  const handleShareQueue = useCallback(() => {
    const ids = queue.map((t) => t.id);
    if (ids.length > 0) {
      createShareStore.getState().showQueue(ids);
    }
  }, [queue]);

  // --- Shuffle overlay ---
  const [shuffling, setShuffling] = useState(false);
  const shuffleOverlayOpacity = useSharedValue(0);
  const spinAnim = useSharedValue(0);

  const shuffleOverlayStyle = useAnimatedStyle(() => ({
    opacity: shuffleOverlayOpacity.value,
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(spinAnim.value, [0, 1], [0, 360])}deg` }],
  }));

  const handleShuffle = useCallback(async () => {
    if (shuffling) return;
    setShuffling(true);
    spinAnim.value = 0;

    shuffleOverlayOpacity.value = withTiming(1, { duration: 250 });
    spinAnim.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.linear }),
      -1,
    );

    const MIN_DISPLAY = 2000;
    await Promise.all([
      shuffleQueue(),
      new Promise<void>((r) => setTimeout(r, MIN_DISPLAY)),
    ]);

    cancelAnimation(spinAnim);
    shuffleOverlayOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) runOnJS(setShuffling)(false);
    });
  }, [shuffling, shuffleOverlayOpacity, spinAnim]);

  // --- Queue rendering ---

  // Muted primary for active queue item — less jarring against the coloured background
  const queueColors = useMemo(() => ({
    ...colors,
    primary: mixHexColors(colors.primary, colors.textPrimary, 0.45),
  }), [colors]);

  const renderQueueItem = useCallback(
    ({ item, index }: { item: Child; index: number }) => (
      <QueueItemRow
        track={item}
        index={index}
        isActive={index === currentTrackIndex}
        colors={queueColors}
        onPress={handleQueueItemPress}
        onLongPress={handleQueueItemLongPress}
      />
    ),
    [currentTrackIndex, queueColors, handleQueueItemPress, handleQueueItemLongPress],
  );

  const keyExtractor = useCallback(
    (item: Child, index: number) => `${item.id}-${index}`,
    [],
  );

  if (!currentTrack) return null;

  // Build quality label from track metadata
  const qualityParts: string[] = [];
  if (currentTrack.suffix) qualityParts.push(currentTrack.suffix.toUpperCase());
  if (currentTrack.bitRate) qualityParts.push(`${currentTrack.bitRate} kbps`);
  const qualityLabel = qualityParts.join(' \u00b7 ') || null;

  // Album line: "Album Name · 2024"
  const albumParts: string[] = [];
  if (currentTrack.album) albumParts.push(currentTrack.album);
  if (currentTrack.year) albumParts.push(String(currentTrack.year));
  const albumLine = albumParts.join(' \u00b7 ') || null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Gradient background — emanates from the left (art side) */}
        <Animated.View
          style={[StyleSheet.absoluteFillObject, gradientAnimatedStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[gradientStart, gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {/* Content */}
        <View style={[styles.content, {
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 16,
        }]}>
          {/* Toolbar */}
          <Animated.View style={[styles.toolbar, toolbarStyle]}>
            <Pressable
              onPress={handleCollapse}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Collapse player"
              style={({ pressed }) => [styles.collapseButton, pressed && styles.pressed]}
            >
              <Ionicons name="contract-outline" size={22} color={colors.textPrimary} />
              <Text style={[styles.collapseText, { color: colors.textPrimary }]}>
                Now Playing
              </Text>
            </Pressable>
          </Animated.View>

          {/* Two-column layout */}
          <View style={styles.columnsContainer}>
            {/* Left column — art + controls */}
            <Animated.View style={[styles.leftColumn, leftColumnStyle]}>
              {/* Art area — flex: 1 so cover fills available height */}
              <View style={styles.artArea} onLayout={handleArtAreaLayout}>
                {artMaxSize > 0 && (
                  <Animated.View
                    style={[
                      styles.coverWrap,
                      {
                        width: artMaxSize,
                        height: artMaxSize,
                      },
                      coverStyle,
                    ]}
                  >
                    <CachedImage
                      coverArtId={currentTrack.coverArt}
                      size={HERO_COVER_SIZE}
                      style={styles.coverImage}
                      resizeMode="cover"
                    />
                  </Animated.View>
                )}
              </View>

              {/* Track info */}
              <View style={styles.trackInfo}>
                <View style={styles.trackTitleRow}>
                  <View style={styles.trackTitleText}>
                    <MarqueeText style={[styles.trackTitle, { color: colors.textPrimary }]}>
                      {currentTrack.title}
                    </MarqueeText>
                  </View>
                  <MoreOptionsButton
                    onPress={() =>
                      moreOptionsStore.getState().show({ type: 'song', item: currentTrack }, 'playerexpanded')
                    }
                    color={colors.textPrimary}
                  />
                  <ExpandedFavoriteButton trackId={currentTrack.id} colors={colors} />
                </View>
                <Text
                  style={[styles.trackArtist, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {currentTrack.artist ?? 'Unknown Artist'}
                </Text>
                {albumLine && (
                  <Text
                    style={[styles.albumLine, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {albumLine}
                  </Text>
                )}
              </View>

              {/* Progress bar */}
              <View style={styles.progressSection}>
                <PlayerProgressBar
                  position={position}
                  duration={duration}
                  bufferedPosition={bufferedPosition}
                  colors={colors}
                  onSeek={handleSeek}
                  isBuffering={isBuffering}
                  error={error}
                  retrying={retrying}
                  onRetry={retryPlayback}
                />
              </View>

              {/* Transport controls */}
              <View style={styles.controls}>
                <View style={styles.controlSideLeft}>
                  <PlaybackRateButton />
                </View>

                <View style={styles.transportControls}>
                  <Pressable
                    onPress={skipToPrevious}
                    hitSlop={12}
                    disabled={!canSkipPrevious}
                    style={({ pressed }) => [pressed && styles.pressed, !canSkipPrevious && styles.disabled]}
                  >
                    <Ionicons name="play-back" size={32} color={canSkipPrevious ? colors.textPrimary : colors.textSecondary} />
                  </Pressable>

                  {showSkipInterval && (
                    <SkipIntervalButton direction="backward" size={32} />
                  )}

                  <Pressable
                    onPress={togglePlayPause}
                    style={({ pressed }) => [
                      styles.playPauseButton,
                      { backgroundColor: colors.textPrimary },
                      pressed && styles.playPausePressed,
                    ]}
                  >
                    {isBuffering ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={32}
                        color={colors.background}
                        style={!isPlaying ? styles.playIcon : undefined}
                      />
                    )}
                  </Pressable>

                  {showSkipInterval && (
                    <SkipIntervalButton direction="forward" size={32} />
                  )}

                  <Pressable
                    onPress={skipToNext}
                    hitSlop={12}
                    disabled={!canSkipNext}
                    style={({ pressed }) => [pressed && styles.pressed, !canSkipNext && styles.disabled]}
                  >
                    <Ionicons name="play-forward" size={32} color={canSkipNext ? colors.textPrimary : colors.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.controlSideRight}>
                  <RepeatButton />
                </View>
              </View>

              {/* Quality badge */}
              {qualityLabel && (
                <Text style={[styles.qualityBadge, { color: colors.textSecondary }]}>
                  {qualityLabel}
                </Text>
              )}
            </Animated.View>

            {/* Right column — queue or lyrics */}
            <Animated.View style={[styles.rightColumn, rightColumnStyle]}>
              {rightPanelMode === 'queue' ? (
                <>
                  {/* Queue header */}
                  <View style={styles.queueHeaderRow}>
                    <Text style={[styles.queueHeaderText, { color: colors.textPrimary }]}>
                      Queue
                    </Text>
                    <View style={styles.queueActions}>
                      <ShuffleButton
                        onPress={handleShuffle}
                        disabled={shuffling || queue.length < 2}
                      />
                      <Pressable
                        onPress={handleShareQueue}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Share queue"
                        style={({ pressed }) => [
                          styles.queueActionButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
                      </Pressable>
                      <Pressable
                        onPress={handleClearQueue}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Clear queue"
                        style={({ pressed }) => [
                          styles.queueActionButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.clearButtonText, { color: colors.textPrimary }]}>
                          Clear
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Queue list */}
                  <View style={styles.queueList}>
                    <FlashList
                      data={queue}
                      renderItem={renderQueueItem}
                      keyExtractor={keyExtractor}
                      onScrollBeginDrag={closeOpenRow}
                      drawDistance={200}
                      showsVerticalScrollIndicator={false}
                    />
                  </View>
                </>
              ) : rightPanelMode === 'info' ? (
                /* Album info panel — always shows track metadata; enriched with API data when available */
                <AlbumInfoContent
                  track={currentTrack}
                  albumInfo={albumInfoEntry?.albumInfo ?? null}
                  overrideMbid={albumInfoEntry?.overrideMbid ?? null}
                  sanitizedNotes={sanitizedNotes}
                  notesAttributionUrl={notesAttributionUrl}
                  albumInfoLoading={albumInfoLoading}
                  refreshing={albumInfoRefreshing}
                  onRefresh={handleRefreshAlbumInfo}
                  colors={colors}
                />
              ) : (
                /* Lyrics placeholder */
                <View style={styles.lyricsPlaceholder}>
                  <MaterialCommunityIcons name="comment-quote-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.lyricsPlaceholderText, { color: colors.textSecondary }]}>
                    Lyrics coming soon
                  </Text>
                </View>
              )}

              {/* Bottom toggle: lyrics / info / queue */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleButtons}>
                  <Pressable
                    onPress={() => setRightPanelMode('lyrics')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Show lyrics"
                    style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons
                      name="comment-quote-outline"
                      size={22}
                      color={rightPanelMode === 'lyrics' ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => setRightPanelMode('info')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Show album info"
                    style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={22}
                      color={rightPanelMode === 'info' ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => setRightPanelMode('queue')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Show queue"
                    style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons
                      name="playlist-music"
                      size={22}
                      color={rightPanelMode === 'queue' ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Shuffle overlay */}
        {shuffling && (
          <Animated.View
            style={[styles.shuffleOverlay, shuffleOverlayStyle]}
            pointerEvents="auto"
          >
            <View style={[styles.shuffleCard, { backgroundColor: colors.card }]}>
              <Animated.View style={spinStyle}>
                <Ionicons name="shuffle" size={32} color={colors.primary} />
              </Animated.View>
              <Text style={[styles.shuffleText, { color: colors.textPrimary }]}>
                Shuffling\u2026
              </Text>
            </View>
          </Animated.View>
        )}
        <ThemedAlert {...alertProps} />
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/*  Favorite button                                                    */
/* ------------------------------------------------------------------ */

const ExpandedFavoriteButton = memo(function ExpandedFavoriteButton({
  trackId,
  colors,
}: {
  trackId: string;
  colors: { red: string; textSecondary: string };
}) {
  const starred = useIsStarred('song', trackId);
  const offlineMode = offlineModeStore((s) => s.offlineMode);

  const handleToggle = useCallback(() => {
    toggleStar('song', trackId);
  }, [trackId]);

  return (
    <Pressable
      onPress={handleToggle}
      disabled={offlineMode}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={starred ? 'Remove from favorites' : 'Add to favorites'}
      style={({ pressed }) => [
        styles.favoriteButton,
        pressed && !offlineMode && styles.pressed,
        offlineMode && styles.disabled,
      ]}
    >
      <Ionicons
        name={starred ? 'heart' : 'heart-outline'}
        size={24}
        color={starred ? colors.red : colors.textSecondary}
      />
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/*  Album info content                                                 */
/* ------------------------------------------------------------------ */

interface AlbumInfoContentProps {
  track: Child;
  albumInfo: { notes?: string; lastFmUrl?: string; musicBrainzId?: string } | null;
  /** Release-group MBID from user override, or null. */
  overrideMbid: string | null;
  sanitizedNotes: string | null;
  notesAttributionUrl: string | null;
  albumInfoLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  colors: {
    textPrimary: string;
    textSecondary: string;
    primary: string;
    card: string;
    label: string;
    border: string;
  };
}

const AlbumInfoContent = memo(function AlbumInfoContent({
  track,
  albumInfo,
  overrideMbid,
  sanitizedNotes,
  notesAttributionUrl,
  albumInfoLoading,
  refreshing,
  onRefresh,
  colors,
}: AlbumInfoContentProps) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);

  // Reset expand/truncation state when notes change (different album)
  const notesRef = useRef(sanitizedNotes);
  if (notesRef.current !== sanitizedNotes) {
    notesRef.current = sanitizedNotes;
    if (notesExpanded) setNotesExpanded(false);
    if (needsTruncation) setNeedsTruncation(false);
  }

  // Build detail rows from track metadata
  const details = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (track.album) rows.push({ label: 'Album', value: track.album });
    if (track.artist) rows.push({ label: 'Artist', value: track.artist });
    if (track.displayAlbumArtist && track.displayAlbumArtist !== track.artist) {
      rows.push({ label: 'Album Artist', value: track.displayAlbumArtist });
    }
    if (track.displayComposer) rows.push({ label: 'Composer', value: track.displayComposer });
    if (track.year) rows.push({ label: 'Year', value: String(track.year) });
    const genreNames = getGenreNames(track);
    const genreText = genreNames.length > 0 ? genreNames.join(', ') : null;
    if (genreText) rows.push({ label: genreNames.length > 1 ? 'Genres' : 'Genre', value: genreText });
    if (track.bpm) rows.push({ label: 'BPM', value: String(track.bpm) });
    if (track.suffix && track.bitRate) {
      rows.push({ label: 'Format', value: `${track.suffix.toUpperCase()} · ${track.bitRate} kbps` });
    } else if (track.suffix) {
      rows.push({ label: 'Format', value: track.suffix.toUpperCase() });
    }
    if (track.playCount != null && track.playCount > 0) {
      rows.push({ label: 'Play Count', value: String(track.playCount) });
    }
    return rows;
  }, [track]);

  const handleLastFm = useCallback(() => {
    if (albumInfo?.lastFmUrl) Linking.openURL(albumInfo.lastFmUrl);
  }, [albumInfo?.lastFmUrl]);

  const handleMusicBrainz = useCallback(() => {
    if (overrideMbid) {
      // Override MBIDs are release-group IDs
      Linking.openURL(`https://musicbrainz.org/release-group/${overrideMbid}`);
    } else if (albumInfo?.musicBrainzId) {
      Linking.openURL(`https://musicbrainz.org/release/${albumInfo.musicBrainzId}`);
    }
  }, [overrideMbid, albumInfo?.musicBrainzId]);

  const handleWikipedia = useCallback(() => {
    if (notesAttributionUrl) Linking.openURL(notesAttributionUrl);
  }, [notesAttributionUrl]);

  return (
    <ScrollView
      style={styles.infoScrollView}
      contentContainerStyle={styles.infoContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {(albumInfoLoading || refreshing) ? (
        /* Skeleton placeholder */
        <View>
          {[0.4, 0.6, 0.5, 0.35, 0.55].map((w, i) => (
            <View key={i} style={styles.skeletonRow}>
              <View style={[styles.skeletonBar, styles.skeletonLabel]} />
              <View style={[styles.skeletonBar, { width: `${w * 100}%` }]} />
            </View>
          ))}
          <View style={styles.infoSection}>
            {[1, 0.97, 1, 0.95, 0.98, 1, 0.93, 0.96, 1, 0.6].map((w, i) => (
              <View
                key={i}
                style={[styles.skeletonBar, styles.skeletonTextLine, { width: `${w * 100}%` }]}
              />
            ))}
          </View>
          <View style={styles.skeletonLinksRow}>
            {[75, 95, 80].map((w, i) => (
              <View key={i} style={[styles.skeletonBar, styles.skeletonChip, { width: w }]} />
            ))}
          </View>
        </View>
      ) : (
        <>
          {/* Track & album details */}
          {details.map((row) => (
            <View key={row.label} style={[styles.infoDetailRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoDetailLabel, { color: colors.textSecondary }]}>{row.label}</Text>
              <Text style={[styles.infoDetailValue, { color: colors.textPrimary }]} numberOfLines={2}>
                {row.value}
              </Text>
            </View>
          ))}

          {/* Album description */}
          {sanitizedNotes ? (
            <View style={styles.infoSection}>
              <Text
                style={[styles.infoNotesText, { color: colors.textPrimary }]}
                numberOfLines={notesExpanded || !needsTruncation ? undefined : 12}
                onTextLayout={(e) => {
                  if (!needsTruncation && !notesExpanded && e.nativeEvent.lines.length > 15) {
                    setNeedsTruncation(true);
                  }
                }}
              >
                {sanitizedNotes}
              </Text>
              {needsTruncation && (
                <Pressable
                  onPress={() => setNotesExpanded((prev) => !prev)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={[styles.infoReadMore, { color: colors.primary }]}>
                    {notesExpanded ? 'Show less' : 'Show more'}
                  </Text>
                </Pressable>
              )}
              {notesAttributionUrl && (
                <Pressable
                  onPress={handleWikipedia}
                  style={({ pressed }) => [styles.infoAttribution, pressed && styles.pressed]}
                  accessibilityRole="link"
                  accessibilityLabel="Source: Wikipedia"
                >
                  <Text style={[styles.infoAttributionText, { color: colors.textSecondary }]}>
                    Source: Wikipedia
                  </Text>
                  <Ionicons name="open-outline" size={11} color={colors.textSecondary} style={styles.infoLinkArrow} />
                </Pressable>
              )}
            </View>
          ) : null}
        </>
      )}

      {/* External links */}
      {(albumInfo?.lastFmUrl || overrideMbid || albumInfo?.musicBrainzId || notesAttributionUrl) && (
        <View style={styles.infoLinksRow}>
          {albumInfo?.lastFmUrl && (
            <Pressable
              onPress={handleLastFm}
              accessibilityRole="link"
              accessibilityLabel="View on Last.fm"
              style={({ pressed }) => [styles.infoLinkChip, pressed && styles.pressed]}
            >
              <Ionicons name="musical-notes" size={14} color={colors.textPrimary} />
              <Text style={[styles.infoLinkText, { color: colors.textPrimary }]}>Last.fm</Text>
              <Ionicons name="open-outline" size={12} color={colors.textPrimary} style={styles.infoLinkArrow} />
            </Pressable>
          )}
          {(overrideMbid || albumInfo?.musicBrainzId) && (
            <Pressable
              onPress={handleMusicBrainz}
              accessibilityRole="link"
              accessibilityLabel="View on MusicBrainz"
              style={({ pressed }) => [styles.infoLinkChip, pressed && styles.pressed]}
            >
              <Ionicons name="disc" size={14} color={colors.textPrimary} />
              <Text style={[styles.infoLinkText, { color: colors.textPrimary }]}>MusicBrainz</Text>
              <Ionicons name="open-outline" size={12} color={colors.textPrimary} style={styles.infoLinkArrow} />
            </Pressable>
          )}
          {notesAttributionUrl && (
            <Pressable
              onPress={handleWikipedia}
              accessibilityRole="link"
              accessibilityLabel="View on Wikipedia"
              style={({ pressed }) => [styles.infoLinkChip, pressed && styles.pressed]}
            >
              <Ionicons name="globe-outline" size={14} color={colors.textPrimary} />
              <Text style={[styles.infoLinkText, { color: colors.textPrimary }]}>Wikipedia</Text>
              <Ionicons name="open-outline" size={12} color={colors.textPrimary} style={styles.infoLinkArrow} />
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
});

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CONTENT_PADDING,
    height: 48,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapseText: {
    fontSize: 16,
    fontWeight: '600',
  },

  /* --- Two-column layout --- */
  columnsContainer: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: CONTENT_PADDING,
    gap: COLUMN_GAP,
  },
  leftColumn: {
    flex: 45,
  },
  rightColumn: {
    flex: 55,
  },

  /* --- Left column: art --- */
  artArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 14,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },

  /* --- Left column: track info --- */
  trackInfo: {
    marginTop: 20,
    marginBottom: 12,
  },
  trackTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackTitleText: {
    flex: 1,
    minWidth: 0,
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  trackArtist: {
    fontSize: 18,
    marginTop: 4,
  },
  albumLine: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.6,
  },

  /* --- Left column: progress --- */
  progressSection: {
    marginBottom: 16,
  },

  /* --- Left column: transport controls --- */
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  controlSideLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  controlSideRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  transportControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: 248,
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPausePressed: {
    opacity: 0.7,
  },
  playIcon: {
    marginLeft: 3,
  },

  favoriteButton: {
    padding: 4,
  },
  qualityBadge: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.5,
    letterSpacing: 0.3,
  },

  /* --- Right column: queue --- */
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
  },
  queueHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  queueActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  queueActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  queueList: {
    flex: 1,
  },

  /* --- Right column: lyrics placeholder --- */
  lyricsPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  lyricsPlaceholderText: {
    fontSize: 16,
    fontWeight: '500',
  },

  /* --- Skeleton loading --- */
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  skeletonLabel: {
    width: 70,
  },
  skeletonTextLine: {
    height: 14,
    marginBottom: 10,
  },
  skeletonLinksRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 32,
  },
  skeletonChip: {
    height: 28,
    borderRadius: 8,
  },

  /* --- Right column: album info --- */
  infoScrollView: {
    flex: 1,
  },
  infoContent: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  infoSection: {
    marginTop: 32,
  },
  infoSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  infoDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoDetailLabel: {
    fontSize: 17,
    flex: 1,
  },
  infoDetailValue: {
    fontSize: 17,
    fontWeight: '500',
    marginLeft: 16,
    textAlign: 'right',
    flexShrink: 1,
  },
  infoNotesText: {
    fontSize: 17,
    lineHeight: 26,
  },
  infoReadMore: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  infoAttribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  infoAttributionText: {
    fontSize: 14,
    opacity: 0.6,
  },
  infoLoadingRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  infoLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 32,
  },
  infoLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  infoLinkText: {
    fontSize: 15,
    fontWeight: '500',
  },
  infoLinkArrow: {
    opacity: 0.6,
  },

  /* --- Right column: toggle buttons --- */
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  toggleButton: {
    padding: 4,
  },

  /* --- Shuffle overlay --- */
  shuffleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  shuffleCard: {
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
  },
  shuffleText: {
    fontSize: 16,
    fontWeight: '600',
  },

  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
