import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import WaveformLogo from './WaveformLogo';

const PRIMARY = '#1D9BF0';

/** Max time (ms) before we force-finish, even if the animation glitches. */
const SAFETY_TIMEOUT = 5000;

type Props = {
  onFinish: () => void;
};

export default function AnimatedSplashScreen({ onFinish }: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const onFinishRef = useRef(onFinish);
  const didFinish = useRef(false);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const complete = () => {
      if (!didFinish.current) {
        didFinish.current = true;
        onFinishRef.current();
      }
    };

    SplashScreen.hideAsync();

    const pulse = (toValue: number) =>
      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        friction: 6,
        tension: 120,
      });

    const growIn = Animated.spring(scale, {
      toValue: 1.15,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    });

    const anim = Animated.sequence([
      // Phase 1-2: grow from nothing to pulse peak, settle to resting
      growIn,
      pulse(1),
      // Phase 3: two additional pulses
      Animated.sequence([pulse(1.15), pulse(1)]),
      Animated.sequence([pulse(1.15), pulse(1)]),
      // Phase 4: fade out
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    anim.start(() => complete());

    const timeout = setTimeout(complete, SAFETY_TIMEOUT);

    return () => {
      anim.stop();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity, transform: [{ scale }] },
        ]}
      >
        <WaveformLogo size={130} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
