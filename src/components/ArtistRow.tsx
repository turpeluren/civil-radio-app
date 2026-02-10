import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { getCoverArtUrl, type ArtistID3 } from '../services/subsonicService';

const COVER_SIZE = 300;

/** Total row height (padding 12*2 + image 56 = 80). Exported for getItemLayout. */
export const ROW_HEIGHT = 80;

export const ArtistRow = memo(function ArtistRow({ artist }: { artist: ArtistID3 }) {
  const { colors } = useTheme();
  const router = useRouter();
  const uri = getCoverArtUrl(artist.coverArt ?? '', COVER_SIZE) ?? undefined;

  const onPress = useCallback(() => {
    router.push(`/artist/${artist.id}`);
  }, [artist.id, router]);

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
          style={[styles.artistName, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {artist.name}
        </Text>
        <View style={styles.meta}>
          <Ionicons name="disc-outline" size={14} color={colors.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {artist.albumCount === 1 ? '1 album' : `${artist.albumCount} albums`}
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
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  text: {
    flex: 1,
    marginLeft: 12,
  },
  artistName: {
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
});
