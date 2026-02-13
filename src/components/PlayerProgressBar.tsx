/**
 * PlayerProgressBar – seekable progress bar for the full player view.
 *
 * Displays a horizontal track with a filled portion, a draggable thumb,
 * and elapsed / remaining time labels below.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

import { type ThemeColors } from '../constants/theme';
import { formatTrackDuration } from '../utils/formatters';

const TRACK_HEIGHT = 4;
const TRACK_HIT_SLOP = 14;
const THUMB_SIZE = 14;
const ACTIVE_THUMB_SIZE = 18;

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

export interface PlayerProgressBarProps {
  /** Current playback position in seconds. */
  position: number;
  /** Total duration of the current track in seconds. */
  duration: number;
  /** How far ahead the player has buffered, in seconds. */
  bufferedPosition?: number;
  /** Theme colors. */
  colors: ThemeColors;
  /** Called when the user finishes seeking (finger released). */
  onSeek: (seconds: number) => void;
}

export function PlayerProgressBar({
  position,
  duration,
  bufferedPosition = 0,
  colors,
  onSeek,
}: PlayerProgressBarProps) {
  const trackWidth = useRef(0);
  const trackPageX = useRef(0);
  const trackRef = useRef<View>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFraction, setDragFraction] = useState(0);
  const [pendingSeekFraction, setPendingSeekFraction] = useState<number | null>(
    null,
  );
  const thumbScale = useRef(new Animated.Value(1)).current;

  // Refs to hold the latest values for the PanResponder closure
  const dragFractionRef = useRef(dragFraction);
  dragFractionRef.current = dragFraction;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  /** Convert an absolute screen pageX to a 0–1 fraction across the track. */
  const fractionFromPageX = (pageX: number) =>
    clamp((pageX - trackPageX.current) / (trackWidth.current || 1), 0, 1);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Prevent parent ScrollView from stealing the gesture mid-drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_evt, gestureState) => {
        // Use gestureState.x0 (absolute screen X of the initial touch)
        // instead of evt.nativeEvent.locationX which is relative to whichever
        // child element the finger landed on (e.g. the thumb).
        const frac = fractionFromPageX(gestureState.x0);
        setDragFraction(frac);
        setIsDragging(true);
        setPendingSeekFraction(null);
        Animated.spring(thumbScale, {
          toValue: ACTIVE_THUMB_SIZE / THUMB_SIZE,
          useNativeDriver: true,
          friction: 7,
        }).start();
      },
      onPanResponderMove: (_evt, gestureState) => {
        const frac = fractionFromPageX(gestureState.moveX);
        setDragFraction(frac);
      },
      onPanResponderRelease: () => {
        const currentDragFraction = dragFractionRef.current;
        const currentDuration = durationRef.current;
        const seekPosition = currentDragFraction * currentDuration;
        // Hold the visual position at the seek target until the store catches up.
        setPendingSeekFraction(currentDragFraction);
        setIsDragging(false);
        onSeekRef.current(seekPosition);
        Animated.spring(thumbScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
        }).start();
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        Animated.spring(thumbScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
        }).start();
      },
    }),
  ).current;

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      trackWidth.current = e.nativeEvent.layout.width;
      // Measure the absolute screen position of the track container so we
      // can convert pageX touch coordinates into track-relative fractions.
      trackRef.current?.measureInWindow((x) => {
        if (x != null) trackPageX.current = x;
      });
    },
    [],
  );

  // Clear the pending seek fraction once the store position catches up.
  useEffect(() => {
    if (pendingSeekFraction != null && duration > 0) {
      const seekPos = pendingSeekFraction * duration;
      if (Math.abs(position - seekPos) < 2) {
        setPendingSeekFraction(null);
      }
    }
  }, [position, duration, pendingSeekFraction]);

  const fraction = isDragging
    ? dragFraction
    : pendingSeekFraction != null
      ? pendingSeekFraction
      : duration > 0
        ? clamp(position / duration, 0, 1)
        : 0;

  const bufferedFraction =
    duration > 0 ? clamp(bufferedPosition / duration, 0, 1) : 0;

  const displayPosition = isDragging
    ? dragFraction * duration
    : pendingSeekFraction != null
      ? pendingSeekFraction * duration
      : position;
  const remaining = Math.max(0, duration - displayPosition);

  return (
    <View style={styles.container}>
      {/* Track + thumb */}
      <View
        ref={trackRef}
        style={[styles.trackHitArea, { paddingVertical: TRACK_HIT_SLOP }]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <View
          style={[styles.track, { backgroundColor: colors.border }]}
          pointerEvents="none"
        >
          {/* Buffered range (behind played fill) */}
          <View
            style={[
              styles.bufferedFill,
              {
                width: `${bufferedFraction * 100}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
          {/* Played range */}
          <View
            style={[
              styles.fill,
              { width: `${fraction * 100}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
        {/* Thumb */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              backgroundColor: colors.textPrimary,
              left: `${fraction * 100}%`,
              transform: [{ scale: thumbScale }],
            },
          ]}
        />
      </View>
      {/* Time labels */}
      <View style={styles.times}>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          {formatTrackDuration(displayPosition)}
        </Text>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          -{formatTrackDuration(remaining)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  trackHitArea: {
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  bufferedFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    opacity: 0.25,
    borderRadius: TRACK_HEIGHT / 2,
  },
  fill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    marginLeft: -(THUMB_SIZE / 2),
    top: TRACK_HIT_SLOP - THUMB_SIZE / 2 + TRACK_HEIGHT / 2,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
