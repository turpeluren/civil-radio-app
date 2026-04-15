import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SyncedLyricsView } from './SyncedLyricsView';
import { UnsyncedLyricsView } from './UnsyncedLyricsView';
import { type LyricsData } from '../services/subsonicService';
import { type LyricsErrorKind } from '../store/lyricsStore';
import { hexWithAlpha } from '../utils/colors';

export interface LyricsContentProps {
  /**
   * Key prop used by the parent to remount `SyncedLyricsView` on track change.
   * Accepted here for documentation; the parent also passes it via `key`.
   */
  trackId?: string;
  lyricsData: LyricsData | null | undefined;
  lyricsLoading: boolean;
  lyricsError?: LyricsErrorKind | null;
  onRetry?: () => void;
  colors: {
    textPrimary: string;
    textSecondary: string;
    border: string;
    background: string;
  };
}

export const LyricsContent = memo(function LyricsContent({
  lyricsData,
  lyricsLoading,
  lyricsError,
  onRetry,
  colors,
}: LyricsContentProps) {
  const { t } = useTranslation();

  if (lyricsError && !lyricsLoading) {
    return (
      <View style={styles.centerBlock}>
        <Ionicons
          name="cloud-offline-outline"
          size={36}
          color={colors.textSecondary}
          style={styles.errorIcon}
        />
        <Text style={[styles.centerText, { color: colors.textSecondary }]}>
          {lyricsError === 'timeout'
            ? t('lyricsTimedOut')
            : t('lyricsFailedToLoad')}
        </Text>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t('retry')}
            style={({ pressed }) => [
              styles.retryButton,
              { borderColor: hexWithAlpha(colors.border, 0.5) },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>
              {t('retry')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (lyricsLoading) {
    return (
      <View style={styles.skeletonWrap}>
        {[0.82, 0.7, 0.88, 0.55, 0.78].map((w, i) => (
          <View
            key={i}
            style={[styles.skeletonLine, { width: `${w * 100}%` }]}
          />
        ))}
      </View>
    );
  }

  if (!lyricsData || lyricsData.lines.length === 0) {
    return (
      <View style={styles.centerBlock}>
        <MaterialCommunityIcons
          name="music-note-outline"
          size={36}
          color={colors.textSecondary}
          style={styles.errorIcon}
        />
        <Text style={[styles.centerText, { color: colors.textSecondary }]}>
          {t('lyricsNotAvailable')}
        </Text>
      </View>
    );
  }

  if (lyricsData.synced) {
    return (
      <SyncedLyricsView
        lines={lyricsData.lines}
        offsetMs={lyricsData.offsetMs}
        source="structured"
        textColor={colors.textPrimary}
        backgroundColor={colors.background}
      />
    );
  }

  return (
    <UnsyncedLyricsView lines={lyricsData.lines} textColor={colors.textPrimary} />
  );
});

const styles = StyleSheet.create({
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorIcon: {
    marginBottom: 4,
  },
  centerText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
  skeletonWrap: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 18,
  },
  skeletonLine: {
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
