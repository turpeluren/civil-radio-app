import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from './MiniPlayer';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { authStore } from '../store/authStore';
import { playerStore } from '../store/playerStore';

/**
 * Fixed-footer wrapper around `MiniPlayer` for non-tab screens. Sits in the
 * normal layout flow (not floating), so content naturally stacks above it
 * and bottom sheets open over it without z-index games.
 */
export function MiniPlayerFooter() {
  const isWide = useLayoutMode() === 'wide';
  const isLoggedIn = authStore((s) => s.isLoggedIn);
  const hasCurrentTrack = playerStore((s) => s.currentTrack !== null);
  const insets = useSafeAreaInsets();

  if (isWide || !isLoggedIn || !hasCurrentTrack) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
});
