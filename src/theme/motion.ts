import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';

// Motion tokens.
//
// WHY THESE EXIST
// The app makes 105 Animated.timing calls and not one of them specifies
// an easing curve, so every animation runs on React Native's default:
// a symmetric ease-in-out. That curve starts slow, which is exactly
// wrong for anything entering or exiting. The delay lands in the first
// few frames, which is the moment the user is watching most closely, so
// the interface reads as sluggish even when the duration is short.
//
// Two curves cover almost everything:
//   OUT   for things arriving or leaving. Fast at the start, so the
//         response feels immediate, then settles.
//   IN_OUT for things moving from one on-screen position to another,
//         where acceleration at both ends looks natural.
//
// The built-in Easing.ease is too weak to read as deliberate. These are
// the stronger cubic-beziers, the same ones used across well-made web
// UI, expressed here in React Native's Easing.bezier.

export const EASING = {
  /** Entering, exiting, press feedback. Starts fast. */
  OUT: Easing.bezier(0.23, 1, 0.32, 1),
  /** Moving or morphing between two on-screen positions. */
  IN_OUT: Easing.bezier(0.77, 0, 0.175, 1),
  /** Constant motion only: progress bars, marquees, spinners. */
  LINEAR: Easing.linear,
};

// Durations, in milliseconds.
//
// The ceiling for anything the user triggers is 300ms. Past that the
// interface feels like it is thinking rather than responding, and a
// 180ms sheet genuinely feels faster than a 400ms one even though the
// work behind it is identical.
export const DURATION = {
  /** Button and card press feedback. */
  PRESS: 140,
  /** Small things appearing: tooltips, badges, inline errors. */
  QUICK: 180,
  /** Standard entrance for cards, rows, list items. */
  ENTER: 240,
  /** Exits are faster than entrances. Leaving should not be dwelt on. */
  EXIT: 180,
  /** Sheets, modals, full-screen transitions. */
  SHEET: 280,
};

/**
 * How much a pressable shrinks while held.
 *
 * Subtle on purpose. Below about 0.95 it reads as the element being
 * yanked rather than pressed; above 0.99 nobody notices it at all.
 */
export const PRESS_SCALE = 0.97;

/**
 * Delay between items in a staggered list entrance.
 *
 * Short. Anything longer and a list of eight rows takes most of a
 * second to finish arriving, which turns a nicety into a wait.
 */
export const STAGGER_MS = 45;

/**
 * Tracks the OS "reduce motion" setting.
 *
 * Reduced motion does not mean no feedback. Callers should keep opacity
 * and colour changes, which aid comprehension, and drop movement:
 * translation, scale, parallax. Returning a boolean rather than
 * pre-baked values leaves that judgement with the caller.
 */
/**
 * Timing for a screen's entrance sequence, already respecting the OS
 * "reduce motion" setting.
 *
 * WHY THIS EXISTS
 * Two problems, one fix. Thirty of the thirty-five screens that animate
 * never asked whether the user wanted motion at all, and the ones that
 * did stagger hardcoded 100-200ms instead of the 45ms this file defines
 * — so the last section of the login screen took a full second to
 * finish arriving, on a screen with no data to wait for.
 *
 * `fade` and `stagger` collapse under reduced motion rather than
 * disappearing: opacity is what tells you the screen changed, and Apple's
 * own guidance is to reduce motion, not remove feedback. Movement is a
 * different matter — `move` goes to zero so slides and scales snap into
 * place instead of travelling.
 */
export function useEntrance() {
  const reduced = useReducedMotion();
  return {
    reduced,
    /** Delay between staggered steps. */
    stagger: reduced ? 0 : STAGGER_MS,
    /** Opacity fades. Kept under reduced motion, just quicker. */
    fade: reduced ? DURATION.QUICK : DURATION.ENTER,
    /** Translation and scale. Zero under reduced motion. */
    move: reduced ? 0 : DURATION.ENTER,
  };
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!cancelled) setReduced(value);
    });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      if (!cancelled) setReduced(value);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduced;
}
