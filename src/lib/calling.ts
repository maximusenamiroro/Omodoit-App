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

  // await channel.subscribe() does NOT wait for the realtime
  // connection to actually be established — it returns almost
  // immediately, which meant channel.send() below could fire before
  // the WebSocket handshake finished, silently dropping the ring.
  // Waiting for the 'SUBSCRIBED' status via callback is the reliable
  // way to know the channel is actually ready to send on.
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error('Failed to connect: ' + status));
    });
  });

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

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error('Failed to connect: ' + status));
    });
  });

  await channel.send({ type: 'broadcast', event: 'response', payload: { response } });
  supabase.removeChannel(channel);
}

export type CallOutcome = 'completed' | 'declined' | 'missed' | 'cancelled';

export async function logCallOutcome(
  callerId: string, calleeId: string, status: CallOutcome, durationSeconds = 0
) {
  try {
    await supabase.from('call_logs').insert({
      caller_id: callerId,
      callee_id: calleeId,
      status,
      duration_seconds: durationSeconds,
    });
  } catch (err) {
    // Best-effort — a failed log entry shouldn't disrupt the call itself
    console.warn('Could not log call outcome (non-fatal):', err);
  }
}

// ── Agora voice engine ──────────────────────────────────────────────
// Uses "App ID only" auth (no token) — fine for development/testing,
// see src/config/agora.ts for what's needed before a real launch.

// The engine currently holding a channel, if any. Module-level rather
// than per-hook because two call screens can be mounted at once (the
// navigator pushes call screens rather than replacing them), and each
// hook instance can only see its own ref.
let activeEngine: IRtcEngine | null = null;

function releaseActiveEngine() {
  if (!activeEngine) return;
  try {
    activeEngine.leaveChannel();
    activeEngine.release();
  } catch (err) {
    // A half-initialised engine can throw here; losing it is still
    // better than leaving it holding the channel.
    console.warn('Could not cleanly release previous call engine:', err);
  }
  activeEngine = null;
}

// Returns '' when no token could be obtained, which is a valid join
// argument while the Agora project is in App-ID-only mode. A failure
// here must never block a call outright — a user who can't reach the
// token endpoint should still be able to talk, right up until the
// certificate is enforced.
async function fetchAgoraToken(channelName: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('agora-token', {
      body: { channelName },
    });
    if (error) throw error;
    return typeof data?.token === 'string' ? data.token : '';
  } catch (err) {
    console.warn('Could not fetch Agora token, joining without one:', err);
    return '';
  }
}

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

      // Only ONE engine may exist at a time. Agora rejects a join with
      // error -17 (ERR_JOIN_CHANNEL_REJECTED) if the SDK is already in
      // a channel, and that is exactly what happened: a call screen
      // that stayed mounted in the navigation stack kept its engine
      // alive, so the NEXT call could never connect — both sides sat on
      // "Connecting…" forever with no error shown to the user.
      //
      // The per-hook cleanup below is still the normal path; this is
      // the backstop for when a screen doesn't unmount when we expect.
      releaseActiveEngine();

      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      activeEngine = engine;
      engine.initialize({ appId: AGORA_APP_ID });
      engine.enableAudio();

      engine.registerEventHandler({
        onJoinChannelSuccess: () => setConnected(true),
        onUserJoined: () => setRemoteJoined(true),
        onUserOffline: () => setRemoteJoined(false),
        onLeaveChannel: () => setConnected(false),
      });

      // Ask the server to mint a token for this channel. The App
      // Certificate that signs it never leaves the backend — see
      // supabase/functions/agora-token.
      //
      // Falls back to an empty token, which is what Agora accepts while
      // the project is still in App-ID-only mode. That fallback is what
      // makes the migration safe in either order: shipping this before
      // enabling the certificate keeps working, and enabling the
      // certificate before everyone has updated still works for anyone
      // who has. Once every client is on this build and the certificate
      // is enforced, the fallback simply stops being reachable.
      const token = await fetchAgoraToken(channelName);
      if (cancelled) return;

      engine.joinChannel(token, channelName, 0, {
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });
    };

    start();

    return () => {
      cancelled = true;
      if (engineRef.current) {
        if (engineRef.current === activeEngine) activeEngine = null;
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
