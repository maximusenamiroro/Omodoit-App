import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

export default function IncomingCallScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { callerName, callerCategory } = route.params;

  const bounce = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const acceptSlide = useRef(new Animated.Value(50)).current;
  const declineSlide = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.stagger(150, [
      Animated.spring(acceptSlide, { toValue: 0, damping: 12, stiffness: 100, useNativeDriver: true }),
      Animated.spring(declineSlide, { toValue: 0, damping: 12, stiffness: 100, useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: -8, duration: 150, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 8, duration: 150, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: -5, duration: 100, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 5, duration: 100, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.delay(1500),
    ])).start();
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View style={[s.content, { opacity: contentOpacity }]}>
        <Text style={[s.label, { marginTop: insets.top + 60 }]}>Incoming Call</Text>

        <Animated.View style={[s.avatarSection, { transform: [{ translateY: bounce }] }]}>
          <View style={s.glow} />
          <View style={s.avatarOuter}>
            <View style={s.avatar}><Text style={s.avatarText}>{getInitials(callerName)}</Text></View>
          </View>
        </Animated.View>

        <Text style={s.name}>{callerName}</Text>
        <Text style={s.category}>{callerCategory || 'Worker'}</Text>
        <View style={s.badge}><Text style={s.badgeText}>🎤 Omodoit Voice Call</Text></View>
      </Animated.View>

      <View style={[s.bottom, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 20 : 30 }]}>
        <Animated.View style={{ transform: [{ translateY: declineSlide }] }}>
          <TouchableOpacity style={s.declineBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <View style={s.declineInner}><Text style={s.phoneIcon}>📞</Text></View>
            <Text style={s.actionLabel}>Decline</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={{ transform: [{ translateY: acceptSlide }] }}>
          <TouchableOpacity style={s.acceptBtn} onPress={() => navigation.replace('InCall', { workerName: callerName, workerCategory: callerCategory })} activeOpacity={0.85}>
            <View style={s.acceptInner}><Text style={s.phoneIcon}>📞</Text></View>
            <Text style={s.actionLabel}>Accept</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  content: { flex: 1, alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '500', color: colors.white, opacity: 0.7, marginBottom: 50 },
  avatarSection: { alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  glow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: colors.primary + '10' },
  avatarOuter: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: colors.primary + '40', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 36, fontWeight: '700', color: colors.white },
  name: { fontSize: 26, fontWeight: '700', color: colors.white, marginBottom: 6 },
  category: { fontSize: 14, color: colors.white, opacity: 0.5, marginBottom: 24 },
  badge: { backgroundColor: colors.white + '08', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.white + '10' },
  badgeText: { fontSize: 12, color: colors.white, opacity: 0.5 },
  bottom: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 60, paddingTop: 20 },
  declineBtn: { alignItems: 'center' },
  declineInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '135deg' }], shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  acceptBtn: { alignItems: 'center' },
  acceptInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  phoneIcon: { fontSize: 28 },
  actionLabel: { fontSize: 12, color: colors.white, opacity: 0.6, marginTop: 10 },
});
