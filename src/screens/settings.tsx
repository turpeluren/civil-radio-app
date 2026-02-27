import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';

const APP_VERSION = Constants.expoConfig?.version ?? '?';
const BUILD_NUMBER =
  Platform.OS === 'ios'
    ? Constants.expoConfig?.ios?.buildNumber
    : String(Constants.expoConfig?.android?.versionCode ?? '');


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
  { route: '/file-explorer', label: 'File Explorer', subtitle: 'Browse app directories on disk', icon: 'document-text-outline' },
  { route: '/migration-log', label: 'Migration Log', subtitle: 'View results of data migration tasks', icon: 'list-outline' },
];

export function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: { backgroundColor: colors.background },
      }),
    [colors]
  );

  return (
    <ScrollView
      style={[styles.container, dynamicStyles.container]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.navCard, { backgroundColor: colors.card }]}>
        {SETTINGS_LINKS.map((link, index) => (
          <Pressable
            key={link.route}
            onPress={() => router.push(link.route as never)}
            style={({ pressed }) => [
              styles.navRow,
              index < SETTINGS_LINKS.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
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
      </View>
      <Text style={[styles.versionText, { color: colors.textSecondary }]}>
        Version {APP_VERSION} ({BUILD_NUMBER})
      </Text>
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
  },
  navCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
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
