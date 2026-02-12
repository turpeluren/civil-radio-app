/**
 * Drop-in replacement for `<Image>` that loads cover art from the
 * local disk cache when available, and falls back to the remote
 * Subsonic URL on a cache miss (triggering a background download
 * of all size variants for next time).
 *
 * Shows a branded WaveformLogo placeholder while loading, with a
 * smooth crossfade animation when the image becomes available.
 * Debounces remote fetches to avoid unnecessary downloads during
 * fast scrolling in FlashList.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  type ImageProps,
  type ImageStyle,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import WaveformLogo from './WaveformLogo';
import {
  cacheAllSizes,
  getCachedImageUri,
} from '../services/imageCacheService';
import { getCoverArtUrl } from '../services/subsonicService';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Delay before starting a remote download (avoids fetches during fast scrolls). */
const DEBOUNCE_MS = 150;
/** Duration of the placeholder-to-image crossfade. */
const FADE_DURATION_MS = 300;
/** Min size for the placeholder logo (dp). */
const MIN_LOGO_SIZE = 16;
/** Max size for the placeholder logo (dp). */
const MAX_LOGO_SIZE = 48;
/** Logo size as a fraction of the image's smaller dimension. */
const LOGO_SCALE = 0.4;
/** Default colour for the placeholder waveform bars. */
const PLACEHOLDER_COLOR = 'rgba(150,150,150,0.25)';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CachedImageProps extends Omit<ImageProps, 'source'> {
  /** Subsonic cover art ID (e.g. `album.coverArt`). */
  coverArtId: string | undefined;
  /** Requested image size tier (50 | 150 | 300 | 600). */
  size: number;
  /** Optional fallback URI when coverArtId is missing or URL construction fails. */
  fallbackUri?: string;
  /** Optional colour for the placeholder waveform bars. */
  placeholderColor?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Compute the WaveformLogo size from image dimensions. */
function computeLogoSize(w: number | undefined, h: number | undefined): number {
  const smaller = Math.min(w ?? 56, h ?? 56);
  return Math.min(MAX_LOGO_SIZE, Math.max(MIN_LOGO_SIZE, smaller * LOGO_SCALE));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const CachedImage = memo(function CachedImage({
  coverArtId,
  size,
  fallbackUri,
  style,
  placeholderColor,
  ...imageProps
}: CachedImageProps) {
  /* ---- initial synchronous cache check ---- */
  const initialCached = coverArtId ? getCachedImageUri(coverArtId, size) : null;
  const hasInitialImage = !!initialCached || (!coverArtId && !!fallbackUri);

  const [uri, setUri] = useState<string | undefined>(
    initialCached ?? (!coverArtId ? fallbackUri : undefined),
  );
  const [showPlaceholder, setShowPlaceholder] = useState(!hasInitialImage);

  const fadeAnim = useRef(new Animated.Value(hasInitialImage ? 1 : 0)).current;
  const currentIdRef = useRef(coverArtId);

  /* ---- synchronous reset when props change (prevents stale images) ---- */
  useLayoutEffect(() => {
    currentIdRef.current = coverArtId;
    const cached = coverArtId ? getCachedImageUri(coverArtId, size) : null;

    if (cached) {
      // Cache hit: show immediately, no placeholder.
      setUri(cached);
      fadeAnim.stopAnimation();
      fadeAnim.setValue(1);
      setShowPlaceholder(false);
      return;
    }

    if (!coverArtId) {
      // No cover art ID: use fallback or show placeholder.
      setUri(fallbackUri);
      fadeAnim.stopAnimation();
      fadeAnim.setValue(fallbackUri ? 1 : 0);
      setShowPlaceholder(!fallbackUri);
      return;
    }

    // Cache miss: reset to placeholder state, clear any stale URI.
    fadeAnim.stopAnimation();
    fadeAnim.setValue(0);
    setShowPlaceholder(true);
    setUri(undefined);
  }, [coverArtId, size, fallbackUri, fadeAnim]);

  /* ---- debounced remote fetch for cache misses ---- */
  useEffect(() => {
    if (!coverArtId) return;

    // If already cached, the layout effect already handled it.
    const cached = getCachedImageUri(coverArtId, size);
    if (cached) return;

    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled || currentIdRef.current !== coverArtId) return;

      // Set the remote URL so the Image component starts loading.
      const remoteUrl = getCoverArtUrl(coverArtId, size) ?? fallbackUri;
      if (remoteUrl) setUri(remoteUrl);

      // Trigger disk caching for future visits.
      cacheAllSizes(coverArtId)
        .then(() => {
          if (cancelled || currentIdRef.current !== coverArtId) return;
          const newCached = getCachedImageUri(coverArtId, size);
          if (newCached) setUri(newCached);
        })
        .catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [coverArtId, size, fallbackUri]);

  /* ---- fade-in animation on image load ---- */
  const handleImageLoad = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: FADE_DURATION_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowPlaceholder(false);
    });
  }, [fadeAnim]);

  /* ---- derive logo size from numeric style dimensions ---- */
  const flatStyle = StyleSheet.flatten(style) as (ImageStyle & ViewStyle) | undefined;
  const logoSize = computeLogoSize(
    typeof flatStyle?.width === 'number' ? flatStyle.width : undefined,
    typeof flatStyle?.height === 'number' ? flatStyle.height : undefined,
  );

  return (
    <View style={[style as ViewStyle, styles.container]}>
      {showPlaceholder && (
        <View style={styles.placeholder}>
          <WaveformLogo
            size={logoSize}
            color={placeholderColor ?? PLACEHOLDER_COLOR}
          />
        </View>
      )}
      {uri != null && (
        <Animated.Image
          {...imageProps}
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
          onLoad={handleImageLoad}
        />
      )}
    </View>
  );
});

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
