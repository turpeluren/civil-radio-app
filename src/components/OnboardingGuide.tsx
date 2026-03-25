import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { onboardingStore } from '../store/onboardingStore';

/* ------------------------------------------------------------------ */
/*  Slide data                                                         */
/* ------------------------------------------------------------------ */

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  headline: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'swap-horizontal-outline',
    headline: 'Swipe & Long Press',
    body: 'Swipe left or right on any song, album, or artist to access quick actions like adding to playlists, downloading, or deleting. Long press for more options.',
  },
  {
    icon: 'cloud-offline-outline',
    headline: 'Offline Mode',
    body: 'Tap the Offline chip in the filter bar to switch to offline mode. Only your downloaded music will be shown\u00a0\u2014\u00a0perfect for when you\u2019re on the go without a connection.',
  },
  {
    icon: 'settings-outline',
    headline: 'Customise Your Experience',
    body: 'Head to Settings to choose your streaming and download quality, set storage limits, and pick your preferred theme and accent colour.',
  },
];

/* ------------------------------------------------------------------ */
/*  Dot indicator                                                      */
/* ------------------------------------------------------------------ */

const Dots = memo(function Dots({
  count,
  activeIndex,
  activeColor,
  inactiveColor,
}: {
  count: number;
  activeIndex: number;
  activeColor: string;
  inactiveColor: string;
}) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === activeIndex ? activeColor : inactiveColor,
              width: i === activeIndex ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
});

/* ------------------------------------------------------------------ */
/*  OnboardingGuide                                                    */
/* ------------------------------------------------------------------ */

const CARD_HORIZONTAL_MARGIN = 32;
const CARD_MAX_WIDTH = 480;

export const OnboardingGuide = memo(function OnboardingGuide() {
  const visible = onboardingStore((s) => s.visible);
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const cardWidth = Math.min(screenWidth - CARD_HORIZONTAL_MARGIN * 2, CARD_MAX_WIDTH);
  const slideWidth = cardWidth;

  const handleDismiss = useCallback(() => {
    onboardingStore.getState().dismiss();
    setActiveIndex(0);
  }, []);

  const handleNext = useCallback(() => {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      handleDismiss();
    }
  }, [activeIndex, handleDismiss]);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<Slide>[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: slideWidth,
      offset: slideWidth * index,
      index,
    }),
    [slideWidth],
  );

  const renderItem = useCallback(
    ({ item }: { item: Slide }) => (
      <View style={[styles.slide, { width: slideWidth }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name={item.icon} size={48} color={colors.primary} />
        </View>
        <Text style={[styles.headline, { color: colors.textPrimary }]}>
          {item.headline}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {item.body}
        </Text>
      </View>
    ),
    [slideWidth, colors.primary, colors.textPrimary, colors.textSecondary],
  );

  const keyExtractor = useCallback((_: Slide, index: number) => String(index), []);

  const isLastSlide = activeIndex === SLIDES.length - 1;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, width: cardWidth }]}>
          {/* Skip button */}
          <Pressable
            onPress={handleDismiss}
            hitSlop={12}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </Pressable>

          {/* Slides */}
          <FlatList
            ref={listRef}
            data={SLIDES}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            getItemLayout={getItemLayout}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            scrollEventThrottle={16}
            style={styles.slideList}
          />

          {/* Dots */}
          <Dots
            count={SLIDES.length}
            activeIndex={activeIndex}
            activeColor={colors.primary}
            inactiveColor={colors.border}
          />

          {/* Next / Get Started button */}
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.nextButton,
              { backgroundColor: colors.primary },
              pressed && styles.nextButtonPressed,
            ]}
          >
            <Text style={styles.nextButtonText}>
              {isLastSlide ? 'Get Started' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 24,
    paddingTop: 16,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  slideList: {
    flexGrow: 0,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.6,
  },
  slide: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    marginHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonPressed: {
    opacity: 0.85,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
