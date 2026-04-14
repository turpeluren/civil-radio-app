import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../hooks/useTheme';
import {
  processingOverlayStore,
  type OverlayStatus,
} from '../store/processingOverlayStore';

const FADE_MS = 250;
const SUCCESS_DISPLAY_MS = 1200;
const ERROR_DISPLAY_MS = 2000;

export function ProcessingOverlay() {
  const status = processingOverlayStore((s) => s.status);
  const label = processingOverlayStore((s) => s.label);
  const hide = processingOverlayStore((s) => s.hide);
  const { colors } = useTheme();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }

    if (status === 'idle') {
      opacity.value = withTiming(0, { duration: FADE_MS });
      scale.value = withTiming(0.9, { duration: FADE_MS });
    } else {
      opacity.value = withTiming(1, { duration: FADE_MS });
      scale.value = withTiming(1, { duration: FADE_MS });

      if (status === 'success' || status === 'error') {
        const delay = status === 'success' ? SUCCESS_DISPLAY_MS : ERROR_DISPLAY_MS;
        dismissTimer.current = setTimeout(() => {
          hide();
        }, delay);
      }
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [status, hide, opacity, scale]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    pointerEvents: (opacity.value > 0 ? 'auto' : 'none') as 'auto' | 'none',
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const icon = getIcon(status);

  return (
    <Animated.View style={[styles.backdrop, backdropStyle]}>
      <Animated.View style={[styles.card, { backgroundColor: colors.card }, cardStyle]}>
        {status === 'processing' ? (
          <ActivityIndicator size="large" color={colors.textPrimary} />
        ) : icon ? (
          <Ionicons
            name={icon.name}
            size={40}
            color={status === 'error' ? colors.red : colors.primary}
          />
        ) : null}
        {label ? (
          <Animated.Text style={[styles.label, { color: colors.textPrimary }]}>
            {label}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

function getIcon(status: OverlayStatus) {
  switch (status) {
    case 'success':
      return { name: 'checkmark-circle' as const };
    case 'error':
      return { name: 'close-circle' as const };
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 36,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
