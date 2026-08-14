import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  StatusBar, Platform, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { generateCallId, sendCallInvite, useCallResponseListener, logCallOutcome } from '../../lib/calling';

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

export default function OutgoingCallScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { workerName, workerCategory, workerId } = route.params;

  const [callId] = useState(() => generateCallId());
  const [status, setStatus] = useState<'ringing' | 'declined' | 'missed' | 'sending'>('sending');

  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse1Op = useRef(new Animated.Value(0.6)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse2Op = useRef(new Animated.Value(0.4)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const pulse3Op = useRef(new Animated.Value(0.2)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.8)).current;

  // No audio ringback tone yet — that needs a sound library
  // (react-native-sound) plus an actual audio asset, neither of which
  // exist in this project. Vibration is a real, verifiable substitute
  // that needs no new dependency or asset, giving the caller physical
  // confirmation the call is actively ringing.
  useEffect(() => {
    if (status === 'ringing') {
      Vibration.vibrate([500, 1000, 500, 1000], true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [status]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real signaling — waits for the callee to actually respond instead
  // of blindly transitioning to InCall after a fixed timer regardless
  // of whether anyone answered.
  useCallResponseListener(callId, (response) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (response === 'accepted') {
      navigation.replace('InCall', { workerName, workerCategory, callId, isCaller: true, otherUserId: workerId });
    } else {
      setStatus('declined');
      logCallOutcome(user?.id || '', workerId, 'declined');
      setTimeout(() => navigation.goBack(), 1500);
    }
  });

  // A call that never gets answered shouldn't ring forever — 30
  // seconds with no response is treated as missed, matching normal
  // phone call behavior.
  useEffect(() => {
    if (status === 'ringing') {
      timeoutRef.current = setTimeout(() => {
        logCallOutcome(user?.id || '', workerId, 'missed');
        setStatus('missed');
        setTimeout(() => navigation.goBack(), 1000);
      }, 30000);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [status]);

  useEffect(() => {
    if (!workerId) {
      // Can't signal without knowing who to call — shouldn't happen
      // since call sites always pass this, but fail safely rather
      // than sit on a call that can never connect.
      navigation.goBack();
      return;
    }

    sendCallInvite(workerId, callId, user?.id || '', profile?.full_name || 'Someone', workerCategory || '')
      .then(() => setStatus('ringing'))
      .catch((err) => {
        console.error('Failed to send call invite:', err);
        navigation.goBack();
      });
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(avatarScale, { toValue: 1, damping: 12, stiffness: 100, useNativeDriver: true }),
    ]).start();

    const makePulse = (s: Animated.Value, o: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(s, { toValue: 1.8, duration: 1500, useNativeDriver: true }),
          Animated.timing(o, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(s, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(o, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ]));

    makePulse(pulse1, pulse1Op, 0).start();
    makePulse(pulse2, pulse2Op, 500).start();
    makePulse(pulse3, pulse3Op, 1000).start();

    Animated.loop(Animated.stagger(200, [
      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot1, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ])).start();

    // No more auto-connect timer — the useCallResponseListener above
    // is what actually transitions to InCall now, only once the
    // callee has genuinely accepted.
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View style={[s.content, { opacity: contentOpacity }]}>
        <View style={[s.statusRow, { marginTop: insets.top + 60 }]}>
          <Text style={s.callingText}>
            {status === 'declined' ? 'Call Declined' : status === 'missed' ? 'No Answer' : status === 'sending' ? 'Connecting…' : 'Calling'}
          </Text>
          {status === 'ringing' && (
            <View style={s.dotsRow}>
              {[dot1, dot2, dot3].map((d, i) => (
                <Animated.View key={i} style={[s.dot, { opacity: d }]} />
              ))}
            </View>
          )}
        </View>

        <View style={s.avatarSection}>
          <Animated.View style={[s.pulseRing, s.ring3, { transform: [{ scale: pulse3 }], opacity: pulse3Op }]} />
          <Animated.View style={[s.pulseRing, s.ring2, { transform: [{ scale: pulse2 }], opacity: pulse2Op }]} />
          <Animated.View style={[s.pulseRing, s.ring1, { transform: [{ scale: pulse1 }], opacity: pulse1Op }]} />
          <Animated.View style={[s.avatarOuter, { transform: [{ scale: avatarScale }] }]}>
            <View style={s.avatar}><Text style={s.avatarText}>{getInitials(workerName)}</Text></View>
          </Animated.View>
        </View>

        <Text style={s.name}>{workerName}</Text>
        <Text style={s.category}>{workerCategory || 'Worker'}</Text>
      </Animated.View>

      <View style={[s.bottom, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 20 : 30 }]}>
        <TouchableOpacity
          style={s.cancelBtn}
          onPress={() => {
            if (status === 'ringing' || status === 'sending') {
              logCallOutcome(user?.id || '', workerId, 'cancelled');
            }
            navigation.goBack();
          }}
          activeOpacity={0.85}
        >
          <View style={s.cancelInner}><Text style={s.cancelIcon}>📞</Text></View>
          <Text style={s.cancelLabel}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  content: { flex: 1, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 60 },
  callingText: { fontSize: 16, fontWeight: '500', color: colors.white, opacity: 0.7 },
  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  avatarSection: { alignItems: 'center', justifyContent: 'center', width: 200, height: 200, marginBottom: 30 },
  pulseRing: { position: 'absolute', borderRadius: 999, borderWidth: 1.5 },
  ring1: { width: 120, height: 120, borderColor: colors.primary },
  ring2: { width: 160, height: 160, borderColor: colors.primary },
  ring3: { width: 200, height: 200, borderColor: colors.primary },
  avatarOuter: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.primary + '60', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.white },
  name: { fontSize: 24, fontWeight: '700', color: colors.white, marginBottom: 6 },
  category: { fontSize: 14, color: colors.white, opacity: 0.5, marginBottom: 20 },
  bottom: { alignItems: 'center', paddingTop: 20 },
  cancelBtn: { alignItems: 'center' },
  cancelInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '135deg' }], shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  cancelIcon: { fontSize: 28 },
  cancelLabel: { fontSize: 12, color: colors.white, opacity: 0.6, marginTop: 10 },
});
