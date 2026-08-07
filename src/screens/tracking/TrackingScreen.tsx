import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  StatusBar, Platform, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, spacing } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');

const WORKER_LOCATION = { latitude: 6.5244, longitude: 3.3792 };
const CLIENT_LOCATION = { latitude: 6.5344, longitude: 3.3892 };

export default function TrackingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const workerName = route?.params?.workerName || 'John Adewale';
  const service = route?.params?.service || 'Electrical Repair';
  const mapRef = useRef(null);

  const [eta, setEta] = useState(12);
  const [workerPos, setWorkerPos] = useState(WORKER_LOCATION);
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 0, damping: 14, stiffness: 100, useNativeDriver: true }),
    ]).start();

    // Simulate worker moving toward client
    const moveInterval = setInterval(() => {
      setWorkerPos(prev => ({
        latitude: prev.latitude + (CLIENT_LOCATION.latitude - prev.latitude) * 0.05,
        longitude: prev.longitude + (CLIENT_LOCATION.longitude - prev.longitude) * 0.05,
      }));
    }, 3000);

    const etaInterval = setInterval(() => {
      setEta(prev => Math.max(0, prev - 1));
    }, 60000);

    // Fit map to show both markers
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [WORKER_LOCATION, CLIENT_LOCATION],
        { edgePadding: { top: 100, right: 60, bottom: 300, left: 60 }, animated: true }
      );
    }, 500);

    return () => {
      clearInterval(moveInterval);
      clearInterval(etaInterval);
    };
  }, []);

  const handleCall = () => {
    navigation.navigate('OutgoingCall', { workerName, workerCategory: service });
  };

  const handleMessage = () => {
    navigation.navigate('Chat', { otherUserId: 'mock', otherUserName: workerName, otherUserAvatar: null });
  };

  const handleCancel = () => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Map */}
      <MapView
        ref={mapRef}
        style={st.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: (WORKER_LOCATION.latitude + CLIENT_LOCATION.latitude) / 2,
          longitude: (WORKER_LOCATION.longitude + CLIENT_LOCATION.longitude) / 2,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        customMapStyle={darkMapStyle}
      >
        {/* Worker marker */}
        <Marker coordinate={workerPos} title={workerName} description="On the way">
          <View style={st.workerMarker}>
            <Text style={st.workerMarkerIcon}>🛠️</Text>
          </View>
        </Marker>

        {/* Client marker */}
        <Marker coordinate={CLIENT_LOCATION} title="Your Location">
          <View style={st.clientMarker}>
            <Text style={st.clientMarkerIcon}>📍</Text>
          </View>
        </Marker>

        {/* Path */}
        <Polyline
          coordinates={[workerPos, CLIENT_LOCATION]}
          strokeColor={colors.primary}
          strokeWidth={3}
          lineDashPattern={[10, 5]}
        />
      </MapView>

      {/* Back button */}
      <TouchableOpacity style={[st.backBtn, { top: insets.top + 10 }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Text style={st.backText}>←</Text>
      </TouchableOpacity>

      {/* Bottom card */}
      <Animated.View style={[st.bottomCard, { opacity: cardOpacity, transform: [{ translateY: cardSlide }], paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : 20 }]}>
        <View style={st.etaBanner}>
          <View style={st.etaDot} />
          <Text style={st.etaText}>{eta > 0 ? 'Worker is on the way' : 'Worker has arrived!'}</Text>
          <Text style={st.etaTime}>{eta > 0 ? eta + ' min' : 'Here!'}</Text>
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
              <Text style={st.ratingValue}>4.9</Text>
              <Text style={st.ratingCount}>(47 reviews)</Text>
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
  etaDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
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
