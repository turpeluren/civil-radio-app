import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { getCoverArtUrl, type ArtistID3 } from '../services/subsonicService';

const COVER_SIZE = 300;

export const ArtistCard = memo(function ArtistCard({
  artist,
  width,
}: {
  artist: ArtistID3;
  width: number;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const uri = getCoverArtUrl(artist.coverArt ?? '', COVER_SIZE) ?? undefined;
  const imageSize = width - 16; // 8px padding on each side

  const onPress = useCallback(() => {
    router.push(`/artist/${artist.id}`);
  }, [artist.id, router]);

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
        style={[styles.artistName, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {artist.name}
      </Text>
      <Text
        style={[styles.albumCount, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {artist.albumCount === 1
          ? '1 album'
          : `${artist.albumCount} albums`}
      </Text>
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
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  artistName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  albumCount: {
    fontSize: 13,
    marginTop: 2,
  },
});
