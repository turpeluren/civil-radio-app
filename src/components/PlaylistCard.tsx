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

export const PlaylistCard = memo(function PlaylistCard({
  playlist,
  width,
}: {
  playlist: Playlist;
  width: number;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const uri = getCoverArtUrl(playlist.coverArt ?? '', COVER_SIZE) ?? undefined;
  const imageSize = width - 16; // 8px padding on each side

  const onPress = useCallback(() => {
    router.push(`/playlist/${playlist.id}`);
  }, [playlist.id, router]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, width },
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri }}
        style={[styles.cover, { width: imageSize, height: imageSize }]}
        resizeMode="cover"
      />
      <Text
        style={[styles.playlistName, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {playlist.name}
      </Text>
      <View style={styles.meta}>
        <Ionicons name="musical-notes-outline" size={12} color={colors.primary} />
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {playlist.songCount}
        </Text>
        <View style={styles.metaSpacer} />
        <Ionicons name="time-outline" size={12} color={colors.primary} />
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {formatDuration(playlist.duration)}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  cover: {
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  playlistName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaText: {
    fontSize: 12,
    marginLeft: 3,
  },
  metaSpacer: {
    width: 8,
  },
});
