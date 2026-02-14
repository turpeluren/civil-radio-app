import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CachedImage } from './CachedImage';
import { useTheme } from '../hooks/useTheme';
import { type Child } from '../services/subsonicService';
import { formatTrackDuration } from '../utils/formatters';

const COVER_SIZE = 300;

/** Total row height (padding 12*2 + image 56 = 80). Exported for getItemLayout. */
export const ROW_HEIGHT = 80;

export const SongRow = memo(function SongRow({ song, onPress }: { song: Child; onPress?: () => void }) {
  const { colors } = useTheme();
  const duration =
    song.duration != null ? formatTrackDuration(song.duration) : '—';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card },
        pressed && styles.pressed,
      ]}
    >
      <CachedImage coverArtId={song.coverArt} size={COVER_SIZE} style={styles.cover} resizeMode="cover" />
      <View style={styles.text}>
        <Text
          style={[styles.songName, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {song.title}
        </Text>
        <Text
          style={[styles.artistName, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {song.artist ?? 'Unknown Artist'}
        </Text>
        <View style={styles.meta}>
          <View style={styles.metaAlbum}>
            <Ionicons name="disc-outline" size={14} color={colors.primary} />
            <View style={styles.albumTextWrapper}>
              <Text
                style={[styles.albumText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {song.album ?? 'Unknown Album'}
              </Text>
            </View>
          </View>
          <View style={styles.metaDuration}>
            <Ionicons name="time-outline" size={14} color={colors.primary} />
            <Text style={[styles.durationText, { color: colors.textSecondary }]}>
              {duration}
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
  songName: {
    fontSize: 16,
    fontWeight: '600',
  },
  artistName: {
    fontSize: 14,
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaAlbum: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  albumTextWrapper: {
    flex: 1,
    marginLeft: 3,
  },
  albumText: {
    fontSize: 13,
  },
  metaDuration: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  durationText: {
    fontSize: 13,
    marginLeft: 3,
  },
});
