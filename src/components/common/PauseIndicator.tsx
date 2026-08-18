import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { DURATION, EASING, useReducedMotion } from '../../theme/motion';

// The "you paused this" mark on a video.
//
// It replaces a text glyph in a flat circle, which had two problems: it
// was rendered inside the video container where the player's surface
// covered it, so pausing gave no visible feedback at all, and the glyph
// itself was a text character whose shape and weight varied by platform
// font. This draws the triangle from views instead, so it is identical
// on Android and iOS.
//
// It appears fast and leaves faster. Pausing should feel acknowledged
// immediately; resuming should get out of the way rather than linger
// over the video you are trying to watch.

interface Props {
  visible: boolean;
}

export default function PauseIndicator({ visible }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      // Exits are quicker than entrances. The mark has done its job the
      // moment playback resumes.
      duration: visible ? DURATION.QUICK : DURATION.PRESS,
      easing: EASING.OUT,
      useNativeDriver: true,
    }).start();
  }, [visible, progress]);

  // Never from scale 0. Things in the real world do not appear out of
  // nothing, and an element that does reads as a glitch rather than an
  // arrival.
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { opacity: progress, transform: reduced ? [] : [{ scale }] },
      ]}
    >
      <View style={styles.circle}>
        {/* A triangle built from a border, so it is pixel-identical on
            both platforms rather than depending on a font's glyph. */}
        <View style={styles.triangle} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  triangle: {
    width: 0,
    height: 0,
    // Optically centred: a triangle's visual mass sits left of its
    // bounding box, so nudging it right makes it look centred.
    marginLeft: 6,
    borderTopWidth: 15,
    borderBottomWidth: 15,
    borderLeftWidth: 25,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#fff',
    backgroundColor: 'transparent',
  },
});
