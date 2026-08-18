import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme';

interface TabIconProps {
  name: 'reels' | 'explore' | 'flash' | 'inbox' | 'profile' | 'station';
  focused: boolean;
  isFlash?: boolean;
}

export default function TabIcon({ name, focused, isFlash }: TabIconProps) {
  const activeColor = isFlash ? colors.flash : colors.primary;
  const color = focused ? activeColor : colors.textMuted;

  if (isFlash) {
    return (
      <View style={[styles.flashContainer, focused && styles.flashContainerActive]}>
        <View style={styles.flashBolt}>
          <View style={[styles.boltTop, { borderBottomColor: focused ? colors.flash : colors.flash + '90' }]} />
          <View style={[styles.boltBottom, { borderTopColor: focused ? colors.flash : colors.flash + '90' }]} />
        </View>
      </View>
    );
  }


  if (name === 'reels') {
    return (
      <View style={styles.iconContainer}>
        <View style={[
          styles.reelsIcon,
          {
            borderColor: color,
            backgroundColor: focused ? color + '15' : 'transparent',
          },
        ]}>
          <View style={[styles.reelsTriangle, { borderLeftColor: color }]} />
        </View>
      </View>
    );
  }

  if (name === 'explore') {
    return (
      <View style={styles.iconContainer}>
        <View style={[styles.exploreOuter, { borderColor: color }]}>
          <View style={[styles.exploreDot, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (name === 'inbox') {
    return (
      <View style={styles.iconContainer}>
        <View style={[styles.inboxIcon, { borderColor: color }]}>
          <View style={[styles.inboxLine, { backgroundColor: color }]} />
          <View style={[styles.inboxLine2, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (name === 'station') {
    return (
      <View style={styles.iconContainer}>
        <View style={[styles.stationOuter, { borderColor: color }]}>
          <View style={[styles.stationInner, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (name === 'profile') {
    return (
      <View style={styles.iconContainer}>
        <View style={[styles.profileHead, { backgroundColor: color }]} />
        <View style={[styles.profileBody, { backgroundColor: color }]} />
      </View>
    );
  }

  // Every name in the union is handled above. This only catches a name
  // added to the type without a shape, and shows a neutral dot rather
  // than a stray character.
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.unknownDot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  unknownDot: { width: 8, height: 8, borderRadius: 4 },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Reels icon — rounded rectangle with play triangle
  reelsIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelsTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },

  // Explore icon — circle with dot
  exploreOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Inbox icon — chat bubble shape
  inboxIcon: {
    width: 24,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    paddingLeft: 5,
  },
  inboxLine: {
    width: 10,
    height: 2,
    borderRadius: 1,
    marginBottom: 2,
  },
  inboxLine2: {
    width: 7,
    height: 2,
    borderRadius: 1,
  },

  // Station icon — grid/dashboard
  stationOuter: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },

  // Profile icon — person silhouette
  profileHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 1,
  },
  profileBody: {
    width: 18,
    height: 9,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },

  // Flash icon
  flashContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.flash + '12',
    borderWidth: 1.5,
    borderColor: colors.flash + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashContainerActive: {
    backgroundColor: colors.flash + '20',
    borderColor: colors.flash + '50',
  },
  flashBolt: {
    alignItems: 'center',
  },
  boltTop: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 2,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -2,
  },
  boltBottom: {
    width: 0,
    height: 0,
    borderLeftWidth: 2,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },

  fallback: {
    fontSize: 20,
  },
});