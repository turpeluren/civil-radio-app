import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DownloadButton } from './DownloadButton';
import { useTheme } from '../hooks/useTheme';
import { filterBarStore } from '../store/filterBarStore';

function FilterChip({
  label,
  icon,
  active,
  onToggle,
  colors,
}: {
  label: string;
  icon: string;
  active: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.primary : colors.inputBg },
      ]}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={14}
        color={active ? '#fff' : colors.textSecondary}
        style={styles.chipIcon}
      />
      <Text
        style={[
          styles.chipLabel,
          { color: active ? '#fff' : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const FilterBar = memo(function FilterBar({
  routeName,
}: {
  routeName: string;
}) {
  const { colors } = useTheme();

  const downloadedOnly = filterBarStore((s) => s.downloadedOnly);
  const favoritesOnly = filterBarStore((s) => s.favoritesOnly);
  const toggleDownloaded = filterBarStore((s) => s.toggleDownloaded);
  const toggleFavorites = filterBarStore((s) => s.toggleFavorites);
  const hideDownloaded = filterBarStore((s) => s.hideDownloaded);
  const hideFavorites = filterBarStore((s) => s.hideFavorites);
  const layoutToggle = filterBarStore((s) => s.layoutToggle);
  const downloadButtonConfig = filterBarStore((s) => s.downloadButtonConfig);

  const handleLayoutToggle = useCallback(() => {
    layoutToggle?.onToggle();
  }, [layoutToggle]);

  if (routeName === 'settings') return null;

  const showDownloadedChip = !hideDownloaded;
  const showFavoritesChip = routeName !== 'favorites' && !hideFavorites;

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {showDownloadedChip && (
          <FilterChip
            label="Downloaded"
            icon="arrow-down-circle"
            active={downloadedOnly}
            onToggle={toggleDownloaded}
            colors={colors}
          />
        )}
        {showFavoritesChip && (
          <FilterChip
            label="Favorites"
            icon="heart"
            active={favoritesOnly}
            onToggle={toggleFavorites}
            colors={colors}
          />
        )}
      </View>
      <View style={styles.actions}>
        {downloadButtonConfig && (
          <DownloadButton
            itemId={downloadButtonConfig.itemId}
            type={downloadButtonConfig.type}
            size={22}
            onDownload={downloadButtonConfig.onDownload}
            onDelete={downloadButtonConfig.onDelete}
          />
        )}
        {layoutToggle && (
          <Pressable
            onPress={handleLayoutToggle}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons
              name={layoutToggle.layout === 'list' ? 'grid-outline' : 'list-outline'}
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipIcon: {
    marginRight: 5,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
  },
  actionButtonPressed: {
    opacity: 0.6,
  },
});
