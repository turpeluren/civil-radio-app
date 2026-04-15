import { memo, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

interface LyricsLineRowProps {
  index: number;
  text: string;
  activeIndex: SharedValue<number>;
  textColor: string;
  disabled?: boolean;
  onPress?: (index: number) => void;
  onLayout?: (index: number, y: number, h: number) => void;
}

/**
 * Opacity ramp: 1.0 / 0.65 / 0.45 / 0.30 / 0.20 by |distance| 0,1,2,3,≥4.
 * Scale ramp:   1.0 / 0.96 when active vs. not.
 * Weight crossfade via two stacked Animated.Text layers (600 + 800).
 */
const SPRING = { damping: 18, stiffness: 140, mass: 0.8 } as const;

export const LyricsLineRow = memo(function LyricsLineRow({
  index,
  text,
  activeIndex,
  textColor,
  disabled,
  onPress,
  onLayout,
}: LyricsLineRowProps) {
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      onLayout?.(index, y, height);
    },
    [index, onLayout],
  );

  const handlePress = useCallback(() => {
    if (!disabled) onPress?.(index);
  }, [disabled, onPress, index]);

  // Opacity driven by distance from active line.
  const opacity = useDerivedValue(() => {
    const d = Math.abs(index - activeIndex.value);
    const target = d === 0 ? 1 : d === 1 ? 0.65 : d === 2 ? 0.45 : d === 3 ? 0.30 : 0.20;
    return withSpring(target, SPRING);
  }, [index]);

  // Scale: 1.0 active, 0.96 otherwise.
  const scale = useDerivedValue(() => {
    const d = Math.abs(index - activeIndex.value);
    return withSpring(d === 0 ? 1 : 0.96, SPRING);
  }, [index]);

  // Weight crossfade opacity for the "active" (800) layer.
  const activeLayerOpacity = useDerivedValue(() => {
    const isActive = Math.abs(index - activeIndex.value) === 0 ? 1 : 0;
    return withSpring(isActive, SPRING);
  }, [index]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const activeLayerStyle = useAnimatedStyle(() => ({
    opacity: activeLayerOpacity.value,
  }));

  const inactiveLayerStyle = useAnimatedStyle(() => ({
    opacity: 1 - activeLayerOpacity.value,
  }));

  return (
    <Pressable onPress={handlePress} onLayout={handleLayout} disabled={disabled}>
      <Animated.View style={[styles.row, containerStyle]}>
        <View style={styles.textStack}>
          <Animated.Text
            style={[
              styles.text,
              styles.textInactive,
              { color: textColor },
              inactiveLayerStyle,
            ]}
          >
            {text}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.text,
              styles.textActive,
              styles.textOverlay,
              { color: textColor },
              activeLayerStyle,
            ]}
          >
            {text}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    marginVertical: 14,
    paddingHorizontal: 24,
    transformOrigin: '0% 50%',
  },
  textStack: {
    position: 'relative',
  },
  text: {
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'left',
  },
  textInactive: {
    fontWeight: '600',
  },
  textActive: {
    fontWeight: '800',
  },
  textOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
