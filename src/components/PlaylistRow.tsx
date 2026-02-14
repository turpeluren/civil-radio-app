import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CachedImage } from './CachedImage';
import { useTheme } from '../hooks/useTheme';
import { type Playlist } from '../services/subsonicService';
import { formatCompactDuration } from '../utils/formatters';

const COVER_SIZE = 300;

/** Total row height (padding 12*2 + image 56 = 80). Exported for getItemLayout. */
export const ROW_HEIGHT = 80;

export const PlaylistRow = memo(function PlaylistRow({ playlist }: { playlist: Playlist }) {
  const { colors } = useTheme();
  const router = useRouter();
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
      <CachedImage coverArtId={playlist.coverArt} size={COVER_SIZE} style={styles.cover} resizeMode="cover" />
      <View style={styles.text}>
        <Text
          style={[styles.playlistName, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {playlist.name}
        </Text>
        <View style={styles.meta}>
          <View style={styles.metaLeft}>
            <Ionicons name="musical-notes-outline" size={14} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {playlist.songCount} {playlist.songCount === 1 ? 'track' : 'tracks'}
            </Text>
          </View>
          <View style={styles.metaRight}>
            <Ionicons name="time-outline" size={14} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {formatCompactDuration(playlist.duration)}
            </Text>
          </View>
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
  metaLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  metaRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  metaText: {
    fontSize: 13,
    marginLeft: 3,
  },
});
