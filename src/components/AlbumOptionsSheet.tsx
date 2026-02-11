import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import {
  starAlbum,
  unstarAlbum,
  type AlbumID3,
  type AlbumWithSongsID3,
} from '../services/subsonicService';
import { favoritesStore } from '../store/favoritesStore';

export interface AlbumOptionsSheetProps {
  /** The album to show options for */
  album: AlbumID3 | AlbumWithSongsID3;
  /** Whether the sheet is visible */
  visible: boolean;
  /** Called to dismiss the sheet */
  onClose: () => void;
  /** Called after the starred state changes so the parent can update its own state */
  onStarChanged?: (albumId: string, starred: boolean) => void;
}

export function AlbumOptionsSheet({
  album,
  visible,
  onClose,
  onStarChanged,
}: AlbumOptionsSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const isStarred = Boolean(album.starred);
  const hasArtist = Boolean(album.artistId);

  const handleToggleStar = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isStarred) {
        await unstarAlbum(album.id);
      } else {
        await starAlbum(album.id);
      }
      onStarChanged?.(album.id, !isStarred);
      // Refresh the favorites store so the favorites view stays in sync
      favoritesStore.getState().fetchStarred();
    } catch {
      // Silently fail -- could add error toast later
    } finally {
      setBusy(false);
      onClose();
    }
  }, [album.id, isStarred, busy, onStarChanged, onClose]);

  const handleGoToArtist = useCallback(() => {
    onClose();
    if (album.artistId) {
      router.push(`/artist/${album.artistId}`);
    }
  }, [album.artistId, onClose, router]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        {/* Handle indicator */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Favorite / Unfavorite option */}
        <Pressable
          onPress={handleToggleStar}
          disabled={busy}
          style={({ pressed }) => [
            styles.option,
            pressed && styles.optionPressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.optionIcon}
            />
          ) : (
            <Ionicons
              name={isStarred ? 'heart' : 'heart-outline'}
              size={22}
              color={isStarred ? colors.red : colors.textPrimary}
              style={styles.optionIcon}
            />
          )}
          <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
            {isStarred ? 'Remove from Favorites' : 'Add to Favorites'}
          </Text>
        </Pressable>

        {/* Go to Artist option */}
        {hasArtist && (
          <Pressable
            onPress={handleGoToArtist}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={22}
              color={colors.textPrimary}
              style={styles.optionIcon}
            />
            <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
              Go to Artist
            </Text>
          </Pressable>
        )}

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  optionPressed: {
    opacity: 0.6,
  },
  optionIcon: {
    width: 28,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});
