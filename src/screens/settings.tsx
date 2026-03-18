import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { devOptionsStore } from '../store/devOptionsStore';
import { searchStore } from '../store/searchStore';
import { processingOverlayStore } from '../store/processingOverlayStore';
import { selectionAsync, notificationAsync } from '../utils/haptics';

const APP_VERSION = Constants.expoConfig?.version ?? '?';
const BUILD_NUMBER =
  Platform.OS === 'ios'
    ? Constants.expoConfig?.ios?.buildNumber
    : String((Constants.expoConfig?.android?.versionCode ?? 0) % 1000);


const SETTINGS_LINKS: {
  route: string;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { route: '/settings-server', label: 'Server Management', subtitle: 'Server info, library scanning', icon: 'server-outline' },
  { route: '/settings-appearance', label: 'Appearance & Layout', subtitle: 'Theme, accent color, sort order, grid/list views', icon: 'color-palette-outline' },
  { route: '/settings-audio-quality', label: 'Audio Quality', subtitle: 'Streaming quality, download quality, transcoding', icon: 'musical-notes-outline' },
  { route: '/settings-connectivity', label: 'Connectivity', subtitle: 'Offline mode, trusted SSL certificates', icon: 'globe-outline' },
  { route: '/settings-storage', label: 'Storage & Data', subtitle: 'Image cache, metadata cache, scrobbles', icon: 'folder-outline' },
  { route: '/settings-shares', label: 'Shares', subtitle: 'Manage shared links, alternate URL', icon: 'share-social-outline' },
  { route: '/settings-account', label: 'Account', subtitle: 'Username, password, log out', icon: 'person-outline' },
];

const DEV_SETTINGS_LINKS: typeof SETTINGS_LINKS = [
  { route: '/file-explorer', label: 'File Explorer', subtitle: 'Browse app directories on disk', icon: 'document-text-outline' },
  { route: '/migration-log', label: 'Migration Log', subtitle: 'View results of data migration tasks', icon: 'list-outline' },
];

const TAP_WINDOW_MS = 3000;
const TAP_COUNT_TO_ACTIVATE = 5;

export function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const headerHeight = searchStore((s) => s.headerHeight);
  const devEnabled = devOptionsStore((s) => s.enabled);

  const tapTimestamps = useRef<number[]>([]);
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [countdownText, setCountdownText] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
    };
  }, []);

  const handleVersionTap = useCallback(() => {
    if (devEnabled) return;

    const now = Date.now();
    tapTimestamps.current.push(now);
    tapTimestamps.current = tapTimestamps.current.filter((t) => now - t < TAP_WINDOW_MS);

    const count = tapTimestamps.current.length;
    const remaining = TAP_COUNT_TO_ACTIVATE - count;

    if (countdownTimer.current) clearTimeout(countdownTimer.current);

    if (remaining <= 0) {
      tapTimestamps.current = [];
      setCountdownText(null);
      devOptionsStore.getState().enable();
      notificationAsync();
      processingOverlayStore.getState().showSuccess('Developer options activated');
    } else if (count >= 2) {
      selectionAsync();
      setCountdownText(`${remaining} more tap${remaining === 1 ? '' : 's'} for developer options`);
      countdownTimer.current = setTimeout(() => setCountdownText(null), TAP_WINDOW_MS);
    }
  }, [devEnabled]);

  const visibleLinks = useMemo(
    () => (devEnabled ? [...SETTINGS_LINKS, ...DEV_SETTINGS_LINKS] : SETTINGS_LINKS),
    [devEnabled]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: headerHeight + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {visibleLinks.map((link) => (
        <Pressable
          key={link.route}
          onPress={() => router.push(link.route as never)}
          style={({ pressed }) => [
            styles.navRow,
            { backgroundColor: colors.card },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.navRowLeft}>
            <Ionicons name={link.icon} size={20} color={colors.primary} style={styles.navRowIcon} />
            <View style={styles.navRowText}>
              <Text style={[styles.navRowLabel, { color: colors.textPrimary }]}>
                {link.label}
              </Text>
              <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]}>
                {link.subtitle}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      ))}
      <Pressable onPress={handleVersionTap}>
        <Text style={[styles.versionText, { color: colors.textSecondary }]}>
          {countdownText ?? `Version ${APP_VERSION} (${BUILD_NUMBER})`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  navRowIcon: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  navRowText: {
    flex: 1,
  },
  navRowLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  navRowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.8,
  },
  versionText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
});
