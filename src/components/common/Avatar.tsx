import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme';

// One avatar, everywhere.
//
// This replaces roughly thirty hand-rolled initials fallbacks spread
// across seven screens, each with its own styles and its own idea of
// how big the text should be. Consolidating them is worth doing on
// looks alone, but there were two real bugs hiding in the duplication:
//
// 1. None of them handled a broken image. If avatar_url pointed at
//    something that 404s, every one of them rendered an empty coloured
//    circle with no initials, because the fallback only ran when the
//    URL was null. This falls back on load failure too.
//
// 2. Every fallback used the same brand colour, so a list of twenty
//    people without photos was twenty identical green circles and you
//    could not tell one row from another. The colour here is derived
//    from the name, so it is stable for a given person and varied
//    across a list.
//
// 99 of 121 profiles have no avatar, so this is the common case rather
// than the exception, and it is worth it looking deliberate.

// Picked to sit against a dark background at readable contrast with
// white text. Deliberately not the brand green: an avatar is
// identification, not branding, and using the accent for it makes
// every screen look like it is full of buttons.
const PALETTE = [
  '#2F7D63', '#B4562F', '#3F5F9E', '#8A4B8F',
  '#A8722C', '#31708E', '#94484A', '#5B6B33',
];

function initialsOf(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

// Stable per person: the same name always lands on the same colour, so
// someone's avatar does not change between screens or between launches.
function colourFor(seed?: string | null): string {
  const s = seed || '';
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

interface Props {
  uri?: string | null;
  name?: string | null;
  size?: number;
  /** Ring colour. Omit for no ring. */
  ringColor?: string;
  style?: StyleProp<ViewStyle>;
}

export default function Avatar({ uri, name, size = 44, ringColor, style }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && !failed;

  const box = {
    width: size,
    height: size,
    borderRadius: size / 2,
    ...(ringColor ? { borderWidth: 2, borderColor: ringColor } : null),
  } as const;

  if (showImage) {
    return (
      <Image
        source={{ uri: uri! }}
        style={[styles.base, box, style as StyleProp<ImageStyle>]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.base, styles.fallback, box, { backgroundColor: colourFor(name) }, style]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.4) }]} numberOfLines={1}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.bgCard },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
