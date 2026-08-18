import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle, DimensionValue } from 'react-native';
import { colors } from '../../theme';
import { EASING, useReducedMotion } from '../../theme/motion';

// A placeholder block that breathes.
//
// WHY THIS SHAPE
// 24 of the app's screens showed a centred spinner while loading. A
// spinner says "wait" and nothing else: it does not say how much is
// coming, where it will appear, or whether this screen is a list or a
// form. A skeleton that traces the real layout answers all three before
// the data lands, so the content arrives into a space the eye has
// already accepted rather than replacing something unrelated.
//
// The pulse is opacity only. A sweeping highlight would need a gradient
// dependency, and opacity animates on the native driver, so this costs
// nothing on the mid-range Android these users are on. Under reduce
// motion it holds still at a readable opacity rather than disappearing,
// because the placeholder still has a job to do when it is not moving.

const PULSE_MS = 900;

interface Props {
  width?: DimensionValue;
  height?: number;
  /** Defaults to a pill for text lines; pass 0 for square corners. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Skeleton({ width = '100%', height = 12, radius, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: PULSE_MS, easing: EASING.IN_OUT, useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: PULSE_MS, easing: EASING.IN_OUT, useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    // Stopping matters: a loop left running behind a navigated-away
    // screen keeps the JS thread busy for no visible benefit.
    return () => loop.stop();
  }, [pulse, reduced]);

  const opacity = reduced
    ? 0.6
    : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? height / 2,
          backgroundColor: colors.bgCard,
          opacity,
        },
        style,
      ]}
    />
  );
}
