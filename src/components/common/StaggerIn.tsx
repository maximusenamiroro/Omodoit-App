import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { DURATION, EASING, STAGGER_MS, useReducedMotion } from '../../theme/motion';

// Fades a list item up, slightly after the one above it.
//
// WHY
// A list that appears all at once reads as a single flash. The same
// list arriving in quick succession reads as content being laid down,
// which gives the eye an order to follow and makes the load feel
// shorter than it is.
//
// WHY THE CAP
// The delay is capped after MAX_STAGGERED items. Without a cap, row 40
// of a long list waits nearly two seconds, and any row scrolled into
// view later animates as though the screen had just opened. Past the
// cap everything shares the last delay, so the effect covers the first
// screenful and then gets out of the way.

const MAX_STAGGERED = 8;
const TRAVEL = 12;

interface Props {
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function StaggerIn({ index, children, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      // Skip straight to the resting state. Reduced motion keeps the
      // opacity change and drops the travel.
      progress.setValue(1);
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION.ENTER,
      delay: Math.min(index, MAX_STAGGERED) * STAGGER_MS,
      easing: EASING.OUT,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [progress, index, reduced]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [reduced ? 0 : TRAVEL, 0],
  });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
