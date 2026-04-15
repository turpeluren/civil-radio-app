jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: { View, Text },
    useSharedValue: (init: unknown) => ({ value: init }),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withSpring: (val: number) => val,
    View,
    Text,
  };
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const { LyricsLineRow } = require('../LyricsLineRow');

function setup({
  activeIndex = 0,
  index = 0,
  disabled = false,
  onPress = jest.fn(),
  onLayout = jest.fn(),
}: {
  activeIndex?: number;
  index?: number;
  disabled?: boolean;
  onPress?: jest.Mock;
  onLayout?: jest.Mock;
} = {}) {
  const sv = { value: activeIndex };
  const utils = render(
    <LyricsLineRow
      index={index}
      text={`line ${index}`}
      activeIndex={sv}
      textColor="#ffffff"
      disabled={disabled}
      onPress={onPress}
      onLayout={onLayout}
    />,
  );
  return { ...utils, sv, onPress, onLayout };
}

describe('LyricsLineRow', () => {
  it('renders text in both inactive and active weight layers', () => {
    const { getAllByText } = setup({ index: 0, activeIndex: 0 });
    // Two Animated.Text layers both render the same string for the crossfade.
    expect(getAllByText('line 0').length).toBe(2);
  });

  it('invokes onPress with its index when tapped', () => {
    const onPress = jest.fn();
    const { getAllByText } = setup({ index: 2, activeIndex: 0, onPress });
    fireEvent.press(getAllByText('line 2')[0]);
    expect(onPress).toHaveBeenCalledWith(2);
  });

  it('does not invoke onPress when disabled', () => {
    const onPress = jest.fn();
    const { getAllByText } = setup({ index: 1, activeIndex: 0, onPress, disabled: true });
    fireEvent.press(getAllByText('line 1')[0]);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('forwards onLayout with y/height tuple', () => {
    const onLayout = jest.fn();
    const { getAllByText } = setup({ index: 3, activeIndex: 0, onLayout });
    fireEvent(getAllByText('line 3')[0], 'layout', {
      nativeEvent: { layout: { x: 0, y: 123, width: 200, height: 40 } },
    });
    expect(onLayout).toHaveBeenCalledWith(3, 123, 40);
  });
});
