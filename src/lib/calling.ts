import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  createAgoraRtcEngine, IRtcEngine, ChannelProfileType, ClientRoleType,
} from 'react-native-agora';
import { supabase } from '../api/supabase';
import { AGORA_APP_ID } from '../config/agora';

// ── Signaling (Supabase Realtime — no Agora involved here) ─────────────
// A phone call needs two things: the audio itself (Agora), and a way
// for the OTHER person's phone to even know a call is happening in the
// first place (this part). Without this, there was no mechanism for a
// callee's phone to ever show an incoming call screen — the app could
// only ever navigate straight to a fake "call" that only the caller saw.

export interface IncomingCallPayload {
  callId: string;
  callerId: string;
  callerName: string;
  callerCategory: string;
}

// Every logged-in user listens on their own channel for incoming
// calls. Mounted once near the app root (see AppNavigator) so it
// works regardless of which screen/tab the user is currently on.
export function useIncomingCallListener(
  myUserId: string | null | undefined,
  onIncomingCall: (payload: IncomingCallPayload) => void
) {
  // Holds the latest callback without needing it in the effect's
  // dependency array — the caller typically passes a fresh inline
  // function every render, and including it directly would tear down
  // and resubscribe the realtime channel on every single render.
  const callbackRef = useRef(onIncomingCall);
  useEffect(() => { callbackRef.current = onIncomingCall; }, [onIncomingCall]);

  useEffect(() => {
    if (!myUserId) return;
    const channel = supabase.channel('calls:' + myUserId);

    channel
      .on('broadcast', { event: 'ring' }, ({ payload }) => {
        callbackRef.current(payload as IncomingCallPayload);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [myUserId]);
}

export function generateCallId(): string {
  return 'call_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export async function sendCallInvite(
  calleeId: string, callId: string, callerId: string, callerName: string, callerCategory: string
) {
  const channel = supabase.channel('calls:' + calleeId);
  await channel.subscribe();
  await channel.send({
    type: 'broadcast',
    event: 'ring',
    payload: { callId, callerId, callerName, callerCategory },
  });
  supabase.removeChannel(channel);
}

// The caller listens on the call-specific channel for the callee's
// response, so OutgoingCallScreen knows whether to actually connect
// or show "declined" — instead of blindly transitioning to InCall
// after a fixed timer regardless of what the other person did.
export function useCallResponseListener(
  callId: string | null,
  onResponse: (response: 'accepted' | 'declined') => void
) {
  const callbackRef = useRef(onResponse);
  useEffect(() => { callbackRef.current = onResponse; }, [onResponse]);

  useEffect(() => {
    if (!callId) return;
    const channel = supabase.channel('call_response:' + callId);

    channel
      .on('broadcast', { event: 'response' }, ({ payload }) => {
        callbackRef.current(payload.response);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [callId]);
}

export async function sendCallResponse(callId: string, response: 'accepted' | 'declined') {
  const channel = supabase.channel('call_response:' + callId);
  await channel.subscribe();
  await channel.send({ type: 'broadcast', event: 'response', payload: { response } });
  supabase.removeChannel(channel);
}

// ── Agora voice engine ──────────────────────────────────────────────
// Uses "App ID only" auth (no token) — fine for development/testing,
// see src/config/agora.ts for what's needed before a real launch.

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'Omodoit needs microphone access for voice calls.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true; // iOS prompts automatically on first engine use
}

export function useAgoraCall(channelName: string | null, enabled: boolean) {
  const engineRef = useRef<IRtcEngine | null>(null);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);

  useEffect(() => {
    if (!enabled || !channelName) return;
    let cancelled = false;

    const start = async () => {
      if (AGORA_APP_ID === 'REPLACE_WITH_YOUR_AGORA_APP_ID') {
        console.warn('Agora App ID not configured — see src/config/agora.ts');
        return;
      }

      const granted = await ensureMicPermission();
      if (cancelled) return;
      if (!granted) {
        setPermissionDenied(true);
        return;
      }

      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      engine.initialize({ appId: AGORA_APP_ID });
      engine.enableAudio();

      engine.registerEventHandler({
        onJoinChannelSuccess: () => setConnected(true),
        onUserJoined: () => setRemoteJoined(true),
        onUserOffline: () => setRemoteJoined(false),
        onLeaveChannel: () => setConnected(false),
      });

      engine.joinChannel('', channelName, 0, {
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });
    };

    start();

    return () => {
      cancelled = true;
      if (engineRef.current) {
        engineRef.current.leaveChannel();
        engineRef.current.release();
        engineRef.current = null;
      }
      setConnected(false);
      setRemoteJoined(false);
    };
  }, [channelName, enabled]);

  const toggleMute = () => {
    const next = !muted;
    engineRef.current?.muteLocalAudioStream(next);
    setMuted(next);
  };

  const toggleSpeaker = () => {
    const next = !speaker;
    engineRef.current?.setEnableSpeakerphone(next);
    setSpeaker(next);
  };

  return { connected, remoteJoined, muted, speaker, toggleMute, toggleSpeaker, permissionDenied };
}
