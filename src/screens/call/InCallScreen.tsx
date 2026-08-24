import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated,
  StatusBar, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASING, colors , useReducedMotion} from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import Icon from '../../components/common/Icon';
import { useAgoraCall, logCallOutcome } from '../../lib/calling';
import { useAuth } from '../../context/AuthContext';

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
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { workerName, workerCategory, callId, otherUserId, isCaller } = route.params;

  const { connected, remoteJoined, muted, speaker, toggleMute, toggleSpeaker, permissionDenied } =
    useAgoraCall(callId || null, true);

  const [duration, setDuration] = useState(0);
  const hasLoggedRef = useRef(false);
  const wasRemoteJoinedRef = useRef(false);

  const wave1 = useRef(new Animated.Value(0.3)).current;
  const wave2 = useRef(new Animated.Value(0.5)).current;
  const wave3 = useRef(new Animated.Value(0.4)).current;
  const wave4 = useRef(new Animated.Value(0.6)).current;
  const wave5 = useRef(new Animated.Value(0.3)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (permissionDenied) {
      Alert.alert(
        'Microphone Permission Needed',
        'Enable microphone access in your phone settings to use voice calls.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [permissionDenied, navigation]);

  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 400, easing: EASING.OUT, useNativeDriver: true }).start();

    // Duration only counts once the other person has actually joined
    // the channel — before that there's nothing to time.
    let timer: ReturnType<typeof setInterval> | null = null;
    if (remoteJoined) {
      timer = setInterval(() => setDuration(p => p + 1), 1000);
    }

    // The waveform is decoration on top of audio that plays regardless.
    if (reducedMotion) return;
    const animW = (w: Animated.Value) => Animated.loop(Animated.sequence([
      Animated.timing(w, { toValue: Math.random() * 0.8 + 0.2, duration: 300 + Math.random() * 400, easing: EASING.LINEAR, useNativeDriver: true }),
      Animated.timing(w, { toValue: Math.random() * 0.4 + 0.1, duration: 300 + Math.random() * 400, easing: EASING.LINEAR, useNativeDriver: true }),
    ]));

    const animations = [wave1, wave2, wave3, wave4, wave5].map(w => animW(w));
    if (remoteJoined) animations.forEach(a => a.start());

    return () => { if (timer) clearInterval(timer); };
  }, [remoteJoined, contentOpacity, wave1, wave2, wave3, wave4, wave5]);

  useEffect(() => {
    if (wasRemoteJoinedRef.current && !remoteJoined) {
      // The other party left the call — same outcome as us ending it,
      // just triggered from their side instead of ours.
      if (isCaller && user?.id && otherUserId && !hasLoggedRef.current) {
        hasLoggedRef.current = true;
        logCallOutcome(user.id, otherUserId, 'completed', duration);
      }
      navigation.goBack();
    }
    wasRemoteJoinedRef.current = remoteJoined;
    // Only remoteJoined may retrigger this. `duration` ticks every
    // second, so including it would re-run this block once a second —
    // logging the call outcome repeatedly and calling goBack() on a
    // loop. The other values are read at the moment the remote party
    // leaves, which is exactly when this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteJoined]);

  const handleEndCall = () => {
    // Only the caller logs completion — both InCallScreen instances
    // (caller's and callee's) would otherwise each insert their own
    // row for the exact same call.
    if (isCaller && user?.id && otherUserId && !hasLoggedRef.current) {
      hasLoggedRef.current = true;
      logCallOutcome(user.id, otherUserId, 'completed', duration);
    }
    navigation.goBack();
  };

  const statusText = permissionDenied
    ? 'Microphone unavailable'
    : !connected
      ? 'Connecting…'
      : !remoteJoined
        ? 'Waiting for other party…'
        : 'Connected';

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View style={[s.content, { opacity: contentOpacity }]}>
        <View style={[s.statusRow, { marginTop: insets.top + 40 }]}>
          <View style={[s.connDot, !remoteJoined && { backgroundColor: colors.textMuted }]} />
          <Text style={[s.connText, !remoteJoined && { color: colors.textMuted }]}>{statusText}</Text>
        </View>

        {remoteJoined && <Text style={s.timer}>{formatDuration(duration)}</Text>}

        <View style={s.avatarSection}>
          <View style={s.avatarRing}>
            <View style={s.avatar}><Text style={s.avatarText}>{getInitials(workerName)}</Text></View>
          </View>
        </View>

        <Text style={s.name}>{workerName}</Text>
        <Text style={s.category}>{workerCategory || 'Worker'}</Text>

        {remoteJoined && (
          <View style={s.wavesRow}>
            {[wave1, wave2, wave3, wave4, wave5].map((w, i) => (
              <Animated.View key={i} style={[s.waveBar, { transform: [{ scaleY: w }] }, i === 2 && s.waveCenter]} />
            ))}
          </View>
        )}
      </Animated.View>

      <View style={[s.bottom, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 20 : 30 }]}>
        <View style={s.actionsRow}>
          <PressableScale style={s.actionBtn} onPress={toggleMute}>
            <View style={[s.actionCircle, muted && s.actionCircleActive]}>
              <Icon name={muted ? 'micOff' : 'mic'} size={26} color={muted ? colors.black : colors.white} />
            </View>
            <Text style={[s.actionLabel, muted && s.actionLabelActive]}>{muted ? 'Unmute' : 'Mute'}</Text>
          </PressableScale>

          <PressableScale style={s.actionBtn} onPress={toggleSpeaker}>
            <View style={[s.actionCircle, speaker && s.actionCircleActive]}>
              <Icon name={speaker ? 'speaker' : 'speakerOff'} size={26} color={speaker ? colors.black : colors.white} />
            </View>
            <Text style={[s.actionLabel, speaker && s.actionLabelActive]}>Speaker</Text>
          </PressableScale>

          <PressableScale
            style={s.actionBtn}
            onPress={() => { if (otherUserId) navigation.navigate('Chat', { otherUserId, otherUserName: workerName, otherUserAvatar: null }); }}
          >
            <View style={s.actionCircle}><Icon name="inbox" size={26} color={colors.white} /></View>
            <Text style={s.actionLabel}>Message</Text>
          </PressableScale>
        </View>

        <PressableScale style={s.endBtn} onPress={handleEndCall}>
          <View style={s.endInner}>
            <View style={s.endIconRotate}>
              <Icon name="callEnd" size={30} color={colors.white} filled />
            </View>
          </View>
          <Text style={s.endLabel}>End Call</Text>
        </PressableScale>
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
  avatarSection: { marginBottom: 24, marginTop: 20 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: colors.primary + '30', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.white },
  name: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 4 },
  category: { fontSize: 13, color: colors.white, opacity: 0.5, marginBottom: 30 },
  wavesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, marginBottom: 20 },
  waveBar: { width: 4, height: 40, borderRadius: 2, backgroundColor: colors.primary + '60' },
  waveCenter: { backgroundColor: colors.primary + '90' },
  bottom: { alignItems: 'center', paddingTop: 10 },
  actionsRow: { flexDirection: 'row', gap: 30, marginBottom: 30 },
  actionBtn: { alignItems: 'center', width: 70 },
  actionCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  actionCircleActive: { backgroundColor: colors.primary + '20', borderWidth: 1, borderColor: colors.primary + '40' },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontSize: 11, color: colors.white, opacity: 0.5 },
  actionLabelActive: { color: colors.primary, opacity: 1 },
  endBtn: { alignItems: 'center' },
  endIconRotate: { transform: [{ rotate: '135deg' }] },
  endInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '135deg' }], shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  endIcon: { fontSize: 28 },
  endLabel: { fontSize: 12, color: colors.white, opacity: 0.6, marginTop: 10 },
});
