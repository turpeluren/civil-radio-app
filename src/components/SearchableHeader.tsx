import { Ionicons } from '@expo/vector-icons';
import type { BottomTabHeaderProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterBar } from './FilterBar';
import { useTheme } from '../hooks/useTheme';
import { offlineModeStore } from '../store/offlineModeStore';
import { searchStore } from '../store/searchStore';

const DEBOUNCE_MS = 300;

export function SearchableHeader({ route }: BottomTabHeaderProps) {
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const offlineMode = offlineModeStore((s) => s.offlineMode);

  const query = searchStore((s) => s.query);
  const setQuery = searchStore((s) => s.setQuery);
  const performSearch = searchStore((s) => s.performSearch);
  const showOverlay = searchStore((s) => s.showOverlay);
  const hideOverlay = searchStore((s) => s.hideOverlay);
  // On the search tab, results are shown inline -- no overlay needed
  const isSearchTab = route.name === 'search';

  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      if (text.trim()) {
        if (!isSearchTab) showOverlay();
        debounceTimer.current = setTimeout(() => {
          performSearch();
        }, DEBOUNCE_MS);
      } else {
        hideOverlay();
      }
    },
    [setQuery, performSearch, showOverlay, hideOverlay, isSearchTab]
  );

  const handleFocus = useCallback(() => {
    if (query.trim() && !isSearchTab) {
      showOverlay();
    }
  }, [query, showOverlay, isSearchTab]);

  const handleSubmitEditing = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    hideOverlay();
    inputRef.current?.blur();
    Keyboard.dismiss();
  }, [setQuery, hideOverlay]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <BlurView
      tint={theme === 'dark' ? 'dark' : 'light'}
      intensity={80}
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[styles.inputContainer, { backgroundColor: colors.inputBg }]}
        >
          <Ionicons
            name="search"
            size={18}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder={offlineMode ? 'Offline Search...' : 'Search...'}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onSubmitEditing={handleSubmitEditing}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={handleClear} hitSlop={8} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>
      <FilterBar routeName={route.name} />
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 6,
  },
});
