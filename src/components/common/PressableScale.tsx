import React, { useCallback, useRef } from 'react';
import {
  Animated, Pressable, StyleProp, ViewStyle,
  type PressableProps, type GestureResponderEvent,
} from 'react-native';
import { DURATION, EASING, PRESS_SCALE, useReducedMotion } from '../../theme/motion';

// A pressable that physically depresses.
//
// WHY
// Every one of the app's 209 tappable elements was a TouchableOpacity,
// which fades on press. Fading says "something is happening somewhere".
// Shrinking says "this specific thing heard you". The difference is
// small enough that nobody points at it and large enough that the whole
// app feels more responsive, which is the point: the details users
// never consciously notice are the ones doing the work.
//
// Drop-in for TouchableOpacity: same style prop, same onPress, same
// children. It scales instead of fading, and dims slightly at the same
// time so the feedback still reads on a low-contrast surface.
//
// Under "reduce motion" the scale is dropped and only the opacity
// change remains. Reduced motion means less movement, not no feedback.

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  /** Override the rest scale. Keep it between 0.95 and 0.99. */
  scaleTo?: number;
  /**
   * Accepted and ignored, so a TouchableOpacity can be swapped for this
   * without editing its props. The press dim is handled internally and
   * is deliberately uniform: a button that fades to 0.7 next to one that
   * fades to 0.85 reads as inconsistency, not intent.
   */
  activeOpacity?: number;
  children: React.ReactNode;
}

export default function PressableScale({
  style,
  scaleTo = PRESS_SCALE,
  children,
  onPressIn,
  onPressOut,
  disabled,
  activeOpacity: _ignoredActiveOpacity,
  ...rest
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  // Both directions use EASING.OUT rather than a symmetric curve: the
  // press should register instantly, and the release should snap back
  // rather than drift.
  const animate = useCallback(
    (to: number) => {
      Animated.timing(progress, {
        toValue: to,
        duration: DURATION.PRESS,
        easing: EASING.OUT,
        useNativeDriver: true,
      }).start();
    },
    [progress]
  );

  const handleIn = useCallback(
    (e: GestureResponderEvent) => {
      if (!disabled) animate(1);
      onPressIn?.(e);
    },
    [animate, disabled, onPressIn]
  );

  const handleOut = useCallback(
    (e: GestureResponderEvent) => {
      animate(0);
      onPressOut?.(e);
    },
    [animate, onPressOut]
  );

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, reduced ? 1 : scaleTo],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.86],
  });

  return (
    <Pressable onPressIn={handleIn} onPressOut={handleOut} disabled={disabled} {...rest}>
      <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
