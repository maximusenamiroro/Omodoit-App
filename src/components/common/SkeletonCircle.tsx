import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { colors } from '../../theme';
import { useReducedMotion } from '../../theme/motion';

// A circular loading placeholder that pulses.
//
// The version this replaces was a static grey ring at 40% opacity. A
// still grey shape does not say "loading", it says "empty" or "broken",
// and on a slow connection it says it for a long time. Motion is what
// distinguishes the two, so the only job here is to keep breathing.
//
// Deliberately shaped like the thing it stands in for: same 64px ring
// as a real New Arrivals item, so nothing shifts when content lands.

const PULSE_MS = 900;

export default function SkeletonCircle({ delayMs = 0 }: { delayMs?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    // Staggered so a row of three reads as one object breathing rather
    // than three lights blinking in unison.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(pulse, {
          toValue: 1, duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, delayMs, reduced]);

  const opacity = reduced ? 0.4 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.6] });

  return <Animated.View style={[styles.circle, { opacity }]} />;
}

const styles = StyleSheet.create({
  circle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.bgCard,
    borderWidth: 2, borderColor: colors.border,
  },
});
