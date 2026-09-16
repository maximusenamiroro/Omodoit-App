import { useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { supabase } from '../api/supabase';

// Live GPS tracking via Supabase Realtime Channel *broadcast* — this is
// the cost-conscious pattern from the infrastructure plan: GPS
// coordinates are relayed over the existing websocket connection and
// are NEVER written to the database. A booking that shares location
// every few seconds for a 30-minute job would otherwise be hundreds of
// avoidable database writes; broadcast makes it free regardless of
// how often or how long tracking runs. Only the booking's status
// itself (pending/accepted/completed) is ever persisted.
//
// One channel per booking: 'tracking:{bookingId}'. The worker side
// broadcasts their position; the client side listens for it.

export interface LatLng {
  latitude: number;
  longitude: number;
}

async function ensureLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'Omodoit needs your location to share it with the client while you\'re on a job.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  // iOS: the permission prompt is triggered automatically by the first
  // getCurrentPosition/watchPosition call, using the description we
  // set in Info.plist. requestAuthorization primes it explicitly.
  return new Promise(resolve => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false)
    );
  });
}

// ── Worker side: broadcast live location while enabled ────────────────
// Call with enabled=true only while the worker has an active, accepted
// job — not continuously in the background, to respect battery and
// privacy (matches the "consent-based tracking, stop anytime" design
// from the website's safety section).
export function useBroadcastLocation(bookingId: string | null, enabled: boolean) {
  const watchIdRef = useRef<number | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    // Cleanup if disabled or no booking
    if (!bookingId || !enabled) {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let channel: any = null;

    const start = async () => {
      try {
        const granted = await ensureLocationPermission();
        if (cancelled) return;
        if (!granted) {
          setPermissionDenied(true);
          setLocationError('Location permission denied. Please enable in settings.');
          return;
        }
        setPermissionDenied(false);
        setLocationError(null);

        channel = supabase.channel('tracking:' + bookingId);
        await channel.subscribe();

        watchIdRef.current = Geolocation.watchPosition(
          (position) => {
            if (cancelled || !channel) return;

            // Validate position data before sending
            if (!position.coords?.latitude || !position.coords?.longitude) {
              console.warn('Invalid location data received');
              return;
            }

            channel.send({
              type: 'broadcast',
              event: 'location',
              payload: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: Date.now(),
              },
            });
          },
          (error) => {
            console.warn('Location watch error:', error.message);
            setLocationError(error.message || 'Unable to retrieve location');
            if (error.code === 2) { // POSITION_UNAVAILABLE
              setPermissionDenied(true);
            }
          },
          {
            enableHighAccuracy: true,
            distanceFilter: 10,
            interval: 4000,
            fastestInterval: 2000,
          }
        );
      } catch (err) {
        setLocationError('Failed to initialize tracking');
        console.error('Tracking init error:', err);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (channel) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      }
    };
  }, [bookingId, enabled]);

  return { permissionDenied, locationError };
}

// ── Client side: watch a worker's live location for a booking ─────────
export function useWatchLocation(bookingId: string | null) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase.channel('tracking:' + bookingId);

    channel
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        setPosition({ latitude: payload.latitude, longitude: payload.longitude });
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [bookingId]);

  return { position, connected };
}
