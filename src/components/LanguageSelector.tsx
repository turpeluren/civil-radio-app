import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { i18n } from '../i18n';
import { SUPPORTED_LANGUAGES } from '../i18n/languages';
import { localeStore } from '../store/localeStore';

interface LanguageSelectorProps {
  /** 'settings' uses theme colors; 'login' uses white-on-blue login palette */
  variant?: 'settings' | 'login';
}

export function LanguageSelector({ variant = 'settings' }: LanguageSelectorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const locale = localeStore((s) => s.locale);
  const setLocale = localeStore((s) => s.setLocale);

  const currentCode = locale ?? i18n.language;
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === currentCode);
  const displayName =
    locale === null
      ? t('deviceDefault')
      : (currentLang?.nativeName ?? currentCode);

  const handleSelect = useCallback(
    (code: string | null) => {
      setLocale(code);
      const resolvedCode = code ?? 'en';
      i18n.changeLanguage(resolvedCode);
      setOpen(false);
    },
    [setLocale],
  );

  const palette = useMemo(
    () =>
      variant === 'login'
        ? {
            bg: 'rgba(255,255,255,0.15)',
            text: '#FFFFFF',
            secondary: 'rgba(255,255,255,0.7)',
            border: 'rgba(255,255,255,0.15)',
            check: '#FFFFFF',
          }
        : {
            bg: colors.card,
            text: colors.textPrimary,
            secondary: colors.textSecondary,
            border: colors.border,
            check: colors.primary,
          },
    [variant, colors],
  );

  return (
    <View style={[styles.dropdown, { backgroundColor: palette.bg }]}>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.labelRow}>
          <Ionicons
            name="globe-outline"
            size={20}
            color={palette.secondary}
          />
          <Text style={[styles.label, { color: palette.text }]}>
            {t('language')}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.value, { color: palette.secondary }]}>
            {displayName}
          </Text>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={palette.secondary}
          />
        </View>
      </Pressable>
      {open && (
        <View style={[styles.list, { borderTopColor: palette.border }]}>
          {/* Device default option */}
          <Pressable
            onPress={() => handleSelect(null)}
            style={({ pressed }) => [
              styles.option,
              { borderBottomColor: palette.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.optionText, { color: palette.text }]}>
              {t('deviceDefault')}
            </Text>
            {locale === null && (
              <Ionicons name="checkmark" size={20} color={palette.check} />
            )}
          </Pressable>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isActive = locale === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => handleSelect(lang.code)}
                style={({ pressed }) => [
                  styles.option,
                  { borderBottomColor: palette.border },
                  pressed && styles.pressed,
                ]}
              >
                <View>
                  <Text
                    style={[styles.optionText, { color: palette.text }]}
                  >
                    {lang.nativeName}
                  </Text>
                  {lang.nativeName !== lang.name && (
                    <Text
                      style={[
                        styles.optionSubtext,
                        { color: palette.secondary },
                      ]}
                    >
                      {lang.name}
                    </Text>
                  )}
                </View>
                {isActive && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={palette.check}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    fontSize: 16,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    fontSize: 16,
  },
  optionSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.8,
  },
});
