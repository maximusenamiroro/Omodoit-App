import React, { useEffect, useRef, useState } from 'react';
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

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const ss = sec % 60;
  return m.toString().padStart(2, '0') + ':' + ss.toString().padStart(2, '0');
};

export default function InCallScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { workerName, workerCategory } = route.params;

  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  const wave1 = useRef(new Animated.Value(0.3)).current;
  const wave2 = useRef(new Animated.Value(0.5)).current;
  const wave3 = useRef(new Animated.Value(0.4)).current;
  const wave4 = useRef(new Animated.Value(0.6)).current;
  const wave5 = useRef(new Animated.Value(0.3)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const timer = setInterval(() => setDuration(p => p + 1), 1000);

    const animW = (w: Animated.Value) => Animated.loop(Animated.sequence([
      Animated.timing(w, { toValue: Math.random() * 0.8 + 0.2, duration: 300 + Math.random() * 400, useNativeDriver: true }),
      Animated.timing(w, { toValue: Math.random() * 0.4 + 0.1, duration: 300 + Math.random() * 400, useNativeDriver: true }),
    ]));

    [wave1, wave2, wave3, wave4, wave5].forEach(w => animW(w).start());

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View style={[s.content, { opacity: contentOpacity }]}>
        <View style={[s.statusRow, { marginTop: insets.top + 40 }]}>
          <View style={s.connDot} />
          <Text style={s.connText}>Connected</Text>
        </View>

        <Text style={s.timer}>{formatDuration(duration)}</Text>

        <View style={s.avatarSection}>
          <View style={s.avatarRing}>
            <View style={s.avatar}><Text style={s.avatarText}>{getInitials(workerName)}</Text></View>
          </View>
        </View>

        <Text style={s.name}>{workerName}</Text>
        <Text style={s.category}>{workerCategory || 'Worker'}</Text>

        <View style={s.wavesRow}>
          {[wave1, wave2, wave3, wave4, wave5].map((w, i) => (
            <Animated.View key={i} style={[s.waveBar, { transform: [{ scaleY: w }] }, i === 2 && s.waveCenter]} />
          ))}
        </View>

        <View style={s.encRow}>
          <Text style={s.encIcon}>🔒</Text>
          <Text style={s.encText}>End-to-end encrypted</Text>
        </View>
      </Animated.View>

      <View style={[s.bottom, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 20 : 30 }]}>
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.actionBtn} onPress={() => setMuted(!muted)} activeOpacity={0.85}>
            <View style={[s.actionCircle, muted && s.actionCircleActive]}>
              <Text style={s.actionEmoji}>{muted ? '🔇' : '🎤'}</Text>
            </View>
            <Text style={[s.actionLabel, muted && s.actionLabelActive]}>{muted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={() => setSpeaker(!speaker)} activeOpacity={0.85}>
            <View style={[s.actionCircle, speaker && s.actionCircleActive]}>
              <Text style={s.actionEmoji}>{speaker ? '🔊' : '🔈'}</Text>
            </View>
            <Text style={[s.actionLabel, speaker && s.actionLabelActive]}>Speaker</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} activeOpacity={0.85}>
            <View style={s.actionCircle}><Text style={s.actionEmoji}>💬</Text></View>
            <Text style={s.actionLabel}>Message</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.endBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <View style={s.endInner}><Text style={s.endIcon}>📞</Text></View>
          <Text style={s.endLabel}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  content: { flex: 1, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  connDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  connText: { fontSize: 13, fontWeight: '500', color: colors.primary },
  timer: { fontSize: 42, fontWeight: '200', color: colors.white, letterSpacing: 4, marginBottom: 40, fontVariant: ['tabular-nums'] },
  avatarSection: { marginBottom: 24 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: colors.primary + '30', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.white },
  name: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 4 },
  category: { fontSize: 13, color: colors.white, opacity: 0.5, marginBottom: 30 },
  wavesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, marginBottom: 20 },
  waveBar: { width: 4, height: 40, borderRadius: 2, backgroundColor: colors.primary + '60' },
  waveCenter: { backgroundColor: colors.primary + '90' },
  encRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  encIcon: { fontSize: 12 },
  encText: { fontSize: 11, color: colors.white, opacity: 0.25 },
  bottom: { alignItems: 'center', paddingTop: 10 },
  actionsRow: { flexDirection: 'row', gap: 30, marginBottom: 30 },
  actionBtn: { alignItems: 'center', width: 70 },
  actionCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  actionCircleActive: { backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary + '40' },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontSize: 11, color: colors.white, opacity: 0.5 },
  actionLabelActive: { color: colors.primary, opacity: 1 },
  endBtn: { alignItems: 'center' },
  endInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '135deg' }], shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  endIcon: { fontSize: 28 },
  endLabel: { fontSize: 12, color: colors.white, opacity: 0.6, marginTop: 10 },
});
