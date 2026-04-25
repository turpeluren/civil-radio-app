/**
 * Unit tests for `formatDuration` — the auto-scaling duration formatter
 * used by the home-screen "My Listening" card. Covers all three tiers
 * (minutes / hours+minutes / days+hours) and the boundary transitions.
 */

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: { View, Text },
    Easing: {
      out: (e: unknown) => e,
      cubic: (t: number) => t,
    },
    runOnJS: (fn: () => void) => fn,
    useSharedValue: (init: number) => {
      const ref = React.useRef({ value: init });
      return ref.current;
    },
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (val: number) => val,
  };
});

import { formatDuration } from '../AnimatedNumber';

describe('formatDuration', () => {
  describe('minutes-only tier (< 1h)', () => {
    it('formats zero as "0m"', () => {
      expect(formatDuration(0)).toBe('0m');
    });

    it('floors sub-minute seconds to 0m', () => {
      expect(formatDuration(45)).toBe('0m');
    });

    it('formats whole minutes', () => {
      expect(formatDuration(5 * 60)).toBe('5m');
      expect(formatDuration(59 * 60)).toBe('59m');
    });

    it('floors 59m 59s to 59m', () => {
      expect(formatDuration(59 * 60 + 59)).toBe('59m');
    });
  });

  describe('hours-and-minutes tier (1h–23h59m)', () => {
    it('formats exactly one hour as "1h 0m"', () => {
      expect(formatDuration(60 * 60)).toBe('1h 0m');
    });

    it('formats partial hours', () => {
      expect(formatDuration(60 * 60 + 30 * 60)).toBe('1h 30m');
      expect(formatDuration(2 * 3600 + 5 * 60)).toBe('2h 5m');
    });

    it('formats just before the day boundary', () => {
      expect(formatDuration(23 * 3600 + 59 * 60)).toBe('23h 59m');
    });
  });

  describe('days-and-hours tier (≥ 24h)', () => {
    it('switches to days at exactly 24h', () => {
      expect(formatDuration(24 * 3600)).toBe('1d 0h');
    });

    it('drops minute precision in the day tier', () => {
      // 24h 30m → still 1d 0h (minutes dropped, hours floored)
      expect(formatDuration(24 * 3600 + 30 * 60)).toBe('1d 0h');
    });

    it('formats the heavy-listener case from the original bug', () => {
      // 107h 10m → 4d 11h (was wrapping the column as "107h 10m")
      expect(formatDuration(107 * 3600 + 10 * 60)).toBe('4d 11h');
    });

    it('handles large totals', () => {
      // 33 days, 8 hours
      expect(formatDuration(33 * 24 * 3600 + 8 * 3600)).toBe('33d 8h');
    });
  });

  describe('result is always single-line-friendly', () => {
    it.each([
      0,
      30,
      60 * 60,
      23 * 3600 + 59 * 60,
      24 * 3600,
      107 * 3600 + 10 * 60,
      365 * 24 * 3600,
    ])('value %i produces ≤ 7 characters', (seconds) => {
      expect(formatDuration(seconds).length).toBeLessThanOrEqual(7);
    });
  });
});
