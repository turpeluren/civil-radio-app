import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { getCoverArtUrl, type Playlist } from '../services/subsonicService';

const COVER_SIZE = 300;

/** Format a duration in seconds to a compact string like "46m" or "1h30m". */
function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
}

/** Total row height (padding 12*2 + image 56 = 80). Exported for getItemLayout. */
export const ROW_HEIGHT = 80;

export const PlaylistRow = memo(function PlaylistRow({ playlist }: { playlist: Playlist }) {
  const { colors } = useTheme();
  const router = useRouter();
  const uri = getCoverArtUrl(playlist.coverArt ?? '', COVER_SIZE) ?? undefined;

  const onPress = useCallback(() => {
    router.push(`/playlist/${playlist.id}`);
  }, [playlist.id, router]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card },
        pressed && styles.pressed,
      ]}
    >
      <Image source={{ uri }} style={styles.cover} resizeMode="cover" />
      <View style={styles.text}>
        <Text
          style={[styles.playlistName, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {playlist.name}
        </Text>
        <View style={styles.meta}>
          <Ionicons name="musical-notes-outline" size={14} color={colors.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {playlist.songCount}
          </Text>
          <View style={styles.metaSpacer} />
          <Ionicons name="time-outline" size={14} color={colors.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {formatDuration(playlist.duration)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  text: {
    flex: 1,
    marginLeft: 12,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaText: {
    fontSize: 13,
    marginLeft: 3,
  },
  metaSpacer: {
    width: 10,
  },
});
