import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  StatusBar, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { colors, spacing } from '../../theme';
import { useWatchLocation } from '../../lib/tracking';
import { supabase } from '../../api/supabase';

// Straight-line distance in km — used for an honest "~X km away"
// display. Deliberately NOT presented as a road-distance ETA (e.g.
// "12 min"), since that would need a routing API this app doesn't
// have; a fabricated countdown would be misleading.
function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function TrackingScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { bookingId, workerId, workerName = 'Worker', service = '' } = route?.params || {};
  const mapRef = useRef<MapView | null>(null);

  const { position: workerPos, connected } = useWatchLocation(bookingId || null);
  const [clientPos, setClientPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 0, damping: 14, stiffness: 100, useNativeDriver: true }),
    ]).start();

    // The client's own position, for their marker and initial map
    // center — this is a one-time read of their own device location,
    // not shared with anyone.
    Geolocation.getCurrentPosition(
      (pos) => setClientPos({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => console.warn('Could not get client location:', err.message),
      { enableHighAccuracy: true }
    );
  }, [cardOpacity, cardSlide]);

  // Real rating for this worker, replacing the hardcoded "4.9 (47 reviews)"
  useEffect(() => {
    if (!workerId) return;
    const fetchRating = async () => {
      try {
        const { data } = await supabase.from('reviews').select('rating').eq('worker_id', workerId);
        if (data && data.length > 0) {
          const avg = data.reduce((sum: number, r: any) => sum + r.rating, 0) / data.length;
          setRating({ avg, count: data.length });
        }
      } catch {
        // non-fatal — rating just stays unset
      }
    };
    fetchRating();
  }, [workerId]);

  useEffect(() => {
    if (workerPos && clientPos && mapRef.current) {
      mapRef.current.fitToCoordinates(
        [workerPos, clientPos],
        { edgePadding: { top: 100, right: 60, bottom: 300, left: 60 }, animated: true }
      );
    }
  }, [workerPos, clientPos]);

  const handleCall = () => {
    navigation.navigate('OutgoingCall', { workerName, workerCategory: service, workerId });
  };

  const handleMessage = () => {
    navigation.navigate('Chat', { otherUserId: workerId, otherUserName: workerName, otherUserAvatar: null });
  };

  const handleCancel = () => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
          if (bookingId) {
            await supabase.from('hire_requests').update({ status: 'cancelled' }).eq('id', bookingId);
          }
          navigation.goBack();
        },
      },
    ]);
  };

  const km = workerPos && clientPos ? distanceKm(workerPos, clientPos) : null;
  const initialRegion = clientPos
    ? { latitude: clientPos.latitude, longitude: clientPos.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }
    : { latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <MapView
        ref={mapRef}
        style={st.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        customMapStyle={darkMapStyle}
      >
        {workerPos && (
          <Marker coordinate={workerPos} title={workerName} description="On the way">
            <View style={st.workerMarker}>
              <Text style={st.workerMarkerIcon}>🛠️</Text>
            </View>
          </Marker>
        )}

        {clientPos && (
          <Marker coordinate={clientPos} title="Your Location">
            <View style={st.clientMarker}>
              <Text style={st.clientMarkerIcon}>📍</Text>
            </View>
          </Marker>
        )}

        {workerPos && clientPos && (
          <Polyline
            coordinates={[workerPos, clientPos]}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>

      <TouchableOpacity style={[st.backBtn, { top: insets.top + 10 }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Text style={st.backText}>←</Text>
      </TouchableOpacity>

      <Animated.View style={[st.bottomCard, { opacity: cardOpacity, transform: [{ translateY: cardSlide }], paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : 20 }]}>
        <View style={st.etaBanner}>
          <View style={[st.etaDot, { backgroundColor: connected ? colors.primary : colors.textMuted }]} />
          <Text style={st.etaText}>
            {!connected ? 'Connecting…' : !workerPos ? 'Waiting for worker to share location' : 'Worker is on the way'}
          </Text>
          {km !== null && <Text style={st.etaTime}>{km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'}</Text>}
        </View>

        <View style={st.workerRow}>
          <View style={st.workerAvatar}>
            <Text style={st.workerAvatarText}>{workerName[0]}</Text>
          </View>
          <View style={st.workerInfo}>
            <Text style={st.workerName}>{workerName}</Text>
            <Text style={st.workerService}>{service}</Text>
            <View style={st.ratingRow}>
              <Text style={st.ratingStar}>⭐</Text>
              <Text style={st.ratingValue}>{rating ? rating.avg.toFixed(1) : '—'}</Text>
              <Text style={st.ratingCount}>({rating?.count || 0} reviews)</Text>
            </View>
          </View>
        </View>

        <View style={st.actionsRow}>
          <TouchableOpacity style={st.actionBtn} onPress={handleCall} activeOpacity={0.85}>
            <Text style={st.actionIcon}>📞</Text>
            <Text style={st.actionLabel}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.actionBtn} onPress={handleMessage} activeOpacity={0.85}>
            <Text style={st.actionIcon}>💬</Text>
            <Text style={st.actionLabel}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.actionBtn, st.actionBtnDanger]} onPress={handleCancel} activeOpacity={0.85}>
            <Text style={st.actionIcon}>✕</Text>
            <Text style={[st.actionLabel, { color: '#EF4444' }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1d1d1d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e0e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
];

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  map: { flex: 1 },

  workerMarker: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  workerMarkerIcon: { fontSize: 20 },
  clientMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  clientMarkerIcon: { fontSize: 16 },

  backBtn: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },

  bottomCard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: colors.border, padding: spacing.screenPadding },

  etaBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '10', borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '25', padding: 12, marginBottom: 16, gap: 8 },
  etaDot: { width: 8, height: 8, borderRadius: 4 },
  etaText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary },
  etaTime: { fontSize: 16, fontWeight: '700', color: colors.primary },

  workerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  workerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  workerAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  workerInfo: { flex: 1 },
  workerName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  workerService: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingStar: { fontSize: 11 },
  ratingValue: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  ratingCount: { fontSize: 10, color: colors.textMuted },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  actionBtnDanger: { borderColor: '#EF444430' },
  actionIcon: { fontSize: 18, marginBottom: 4 },
  actionLabel: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
});
