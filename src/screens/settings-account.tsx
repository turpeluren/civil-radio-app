import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientBackground } from '../components/GradientBackground';
import { useTheme } from '../hooks/useTheme';
import { clearImageCache } from '../services/imageCacheService';
import { clearMusicCache } from '../services/musicCacheService';
import { stopPolling } from '../services/scanService';
import { clearApiCache } from '../services/subsonicService';
import { authStore } from '../store/authStore';
import { resetAllStores } from '../store/resetAllStores';

export function SettingsAccountScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const username = authStore((s) => s.username);
  const password = authStore((s) => s.password);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleLogout = () => {
    stopPolling();
    clearApiCache();
    resetAllStores();
    clearImageCache();
    clearMusicCache();
    router.replace('/login');
  };

  const maskedPassword = password ? '\u2022'.repeat(password.length) : '';

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        sectionTitle: { color: colors.label },
        card: { backgroundColor: colors.card },
        logoutButton: { borderColor: colors.red },
        logoutButtonText: { color: colors.red },
      }),
    [colors]
  );

  return (
    <GradientBackground>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, styles.contentGrow, { paddingBottom: Math.max(insets.bottom, 32) }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Credentials</Text>
        <View style={[styles.card, dynamicStyles.card]}>
          <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Username</Text>
            <Text style={[styles.fieldValue, { color: colors.textSecondary }]}>{username ?? '—'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Password</Text>
            <View style={styles.passwordValue}>
              <Text style={[styles.fieldValue, { color: colors.textSecondary }]}>
                {password ? (passwordVisible ? password : maskedPassword) : '—'}
              </Text>
              {password ? (
                <Pressable
                  onPress={() => setPasswordVisible((v) => !v)}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Ionicons
                    name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.logoutSection}>
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            dynamicStyles.logoutButton,
            pressed && styles.logoutButtonPressed,
          ]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutButtonText, dynamicStyles.logoutButtonText]}>Log out</Text>
        </Pressable>
      </View>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  contentGrow: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  fieldLabel: {
    fontSize: 15,
    flex: 1,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  passwordValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pressed: {
    opacity: 0.8,
  },
  logoutSection: {
    marginTop: 'auto',
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonPressed: {
    opacity: 0.8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
