import { memo, useCallback, useMemo, useRef } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface AlphabetScrollerProps {
  /** Set of letters that have at least one matching item */
  activeLetters: Set<string>;
  /** Called when the user taps or drags to a letter */
  onLetterChange: (letter: string) => void;
  /** Extra top offset so the scroller sits below a transparent header */
  topInset?: number;
}

export const AlphabetScroller = memo(function AlphabetScroller({
  activeLetters,
  onLetterChange,
  topInset = 0,
}: AlphabetScrollerProps) {
  const { colors } = useTheme();
  // These refs track the *inner* letter strip, not the full-height outer container
  const stripHeight = useRef(0);
  const stripY = useRef(0);
  const lastLetter = useRef<string | null>(null);

  // Only show letters that have matching items
  const visibleLetters = useMemo(
    () => ALPHABET.filter((l) => activeLetters.has(l)),
    [activeLetters]
  );

  const visibleLettersRef = useRef(visibleLetters);
  visibleLettersRef.current = visibleLetters;

  const resolveLetterFromY = useCallback((pageY: number) => {
    const letters = visibleLettersRef.current;
    if (letters.length === 0 || stripHeight.current === 0) return null;
    const relativeY = pageY - stripY.current;
    const clampedY = Math.max(0, Math.min(relativeY, stripHeight.current));
    const index = Math.floor(
      (clampedY / stripHeight.current) * letters.length
    );
    return letters[Math.min(index, letters.length - 1)];
  }, []);

  const handleTouch = useCallback(
    (pageY: number) => {
      const letter = resolveLetterFromY(pageY);
      if (letter && letter !== lastLetter.current) {
        lastLetter.current = letter;
        onLetterChange(letter);
      }
    },
    [resolveLetterFromY, onLetterChange]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        handleTouch(evt.nativeEvent.pageY);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        handleTouch(evt.nativeEvent.pageY);
      },
      onPanResponderRelease: () => {
        lastLetter.current = null;
      },
      onPanResponderTerminate: () => {
        lastLetter.current = null;
      },
    })
  ).current;

  // Measure the inner letter strip (not the full-height outer container)
  const stripRef = useRef<View>(null);
  const handleStripLayout = useCallback(() => {
    stripRef.current?.measureInWindow((_x, y, _w, h) => {
      stripY.current = y;
      stripHeight.current = h;
    });
  }, []);

  if (visibleLetters.length === 0) return null;

  return (
    <View style={[styles.container, topInset > 0 && { top: topInset }]} {...panResponder.panHandlers}>
      <View
        ref={stripRef}
        onLayout={handleStripLayout}
      >
        {visibleLetters.map((letter) => (
          <Text
            key={letter}
            style={[styles.letter, { color: colors.primary }]}
          >
            {letter}
          </Text>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  letter: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
});
