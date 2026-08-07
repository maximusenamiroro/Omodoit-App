import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');

const MOCK_BOOKINGS = [
  { id: '1', client: 'Fred Dan', job: 'Fix electrical wiring', status: 'pending', time: '30m ago', budget: '₦15,000', location: 'Ikeja' },
  { id: '2', client: 'Sarah Ade', job: 'AC servicing', status: 'accepted', time: '2h ago', budget: '₦12,000', location: 'Lekki' },
];

const MOCK_FLASH_JOBS = [
  { id: '1', service: 'Electrician', location: 'Ikeja, Lagos', budget: '₦15,000', time: '5m ago', distance: '0.8km' },
  { id: '2', service: 'Plumber', location: 'Surulere, Lagos', budget: '₦8,000', time: '12m ago', distance: '1.2km' },
  { id: '3', service: 'AC Repair', location: 'Yaba, Lagos', budget: '₦10,000', time: '18m ago', distance: '2.1km' },
];

export default function WorkstationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [isOnline, setIsOnline] = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const firstName = profile?.full_name?.split(' ')[0] || 'Worker';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const getStatusStyle = (status) => {
    if (status === 'accepted') return { bg: colors.primary + '20', text: colors.primary };
    if (status === 'rejected') return { bg: '#EF444420', text: '#EF4444' };
    return { bg: '#F59E0B20', text: '#F59E0B' };
  };

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>

        <Animated.View style={[st.header, { opacity: headerOpacity }]}>
          <View>
            <Text style={st.greeting}>{greeting}, {firstName} 👋</Text>
            <Text style={st.headerSub}>Your workstation dashboard</Text>
          </View>
          <TouchableOpacity style={st.notifBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
            <Text style={st.notifIcon}>🔔</Text>
            <View style={st.notifDot} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentSlide }] }}>

          {/* Stats Cards */}
          <View style={st.statsRow}>
            {[
              { value: '0', label: 'Active Jobs', icon: '📋', color: colors.primary },
              { value: '₦0', label: 'Today', icon: '💰', color: colors.flash },
              { value: '0', label: 'Pending', icon: '⏳', color: '#F59E0B' },
            ].map((stat, i) => (
              <View key={i} style={st.statCard}>
                <Text style={st.statIcon}>{stat.icon}</Text>
                <Text style={[st.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={st.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Online toggle */}
          <TouchableOpacity style={st.onlineCard} onPress={() => setIsOnline(!isOnline)} activeOpacity={0.85}>
            <View style={st.onlineLeft}>
              <View style={[st.onlineDot, !isOnline && { backgroundColor: colors.textMuted }]} />
              <View>
                <Text style={[st.onlineTitle, !isOnline && { color: colors.textMuted }]}>{isOnline ? 'You are Online' : 'You are Offline'}</Text>
                <Text style={st.onlineSub}>{isOnline ? 'Clients can find and book you' : 'Go online to receive bookings'}</Text>
              </View>
            </View>
            <View style={[st.toggleTrack, !isOnline && { backgroundColor: colors.bgCard }]}>
              <View style={[st.toggleThumb, !isOnline && { alignSelf: 'flex-start' }]} />
            </View>
          </TouchableOpacity>

          {/* Flash Jobs Nearby */}
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>⚡ Flash Jobs Nearby</Text>
            <View style={st.flashCount}>
              <Text style={st.flashCountText}>{MOCK_FLASH_JOBS.length}</Text>
            </View>
          </View>

          {MOCK_FLASH_JOBS.map(job => (
            <TouchableOpacity key={job.id} style={st.flashCard} activeOpacity={0.85}>
              <View style={st.flashTop}>
                <View style={st.flashBadge}>
                  <Text style={st.flashBadgeIcon}>⚡</Text>
                </View>
                <View style={st.flashInfo}>
                  <Text style={st.flashService}>{job.service}</Text>
                  <Text style={st.flashLocation}>📍 {job.location} · {job.distance}</Text>
                </View>
                <Text style={st.flashTime}>{job.time}</Text>
              </View>
              <View style={st.flashBottom}>
                <Text style={st.flashBudget}>{job.budget}</Text>
                <TouchableOpacity style={st.acceptBtn} activeOpacity={0.85}>
                  <Text style={st.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}

          {/* Recent Bookings */}
          <Text style={[st.sectionTitle, { paddingHorizontal: spacing.screenPadding, marginTop: 8, marginBottom: 10 }]}>
            📋 Recent Bookings
          </Text>

          {MOCK_BOOKINGS.length === 0 ? (
            <View style={st.emptyCard}>
              <Text style={st.emptyEmoji}>📋</Text>
              <Text style={st.emptyTitle}>No bookings yet</Text>
              <Text style={st.emptyDesc}>When clients book you, they will appear here</Text>
            </View>
          ) : (
            MOCK_BOOKINGS.map(booking => {
              const status = getStatusStyle(booking.status);
              return (
                <TouchableOpacity key={booking.id} style={st.bookingCard} activeOpacity={0.85}>
                  <View style={st.bookingTop}>
                    <View style={[st.bookingAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={st.bookingAvatarText}>{booking.client[0]}</Text>
                    </View>
                    <View style={st.bookingInfo}>
                      <Text style={st.bookingClient}>{booking.client}</Text>
                      <Text style={st.bookingJob}>{booking.job}</Text>
                      <Text style={st.bookingMeta}>📍 {booking.location} · {booking.time}</Text>
                    </View>
                    <View>
                      <View style={[st.statusBadge, { backgroundColor: status.bg }]}>
                        <Text style={[st.statusText, { color: status.text }]}>{booking.status}</Text>
                      </View>
                      <Text style={st.bookingBudget}>{booking.budget}</Text>
                    </View>
                  </View>
                  {booking.status === 'pending' && (
                    <View style={st.bookingActions}>
                      <TouchableOpacity style={st.declineBtn} activeOpacity={0.85}>
                        <Text style={st.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[st.acceptBookBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
                        <Text style={st.acceptBookBtnText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}

          {/* Quick Actions */}
          <Text style={[st.sectionTitle, { paddingHorizontal: spacing.screenPadding, marginTop: 8, marginBottom: 10 }]}>
            Quick Actions
          </Text>
          <View style={st.quickActions}>
            {[
              { icon: '🎬', label: 'Create Reel', color: colors.primary },
              { icon: '📦', label: 'Add Product', color: colors.flash },
              { icon: '📊', label: 'Analytics', color: colors.info },
              { icon: '💰', label: 'Earnings', color: '#16a34a' },
            ].map((action, i) => (
              <TouchableOpacity key={i} style={st.quickCard} onPress={() => { if (action.label === 'Create Reel') navigation.navigate('CreateReel'); if (action.label === 'Add Product') navigation.navigate('AddProduct'); }} activeOpacity={0.85}>
                <View style={[st.quickIconBg, { backgroundColor: action.color + '15' }]}>
                  <Text style={st.quickIcon}>{action.icon}</Text>
                </View>
                <Text style={st.quickLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.screenPadding, paddingTop: 12, paddingBottom: 12 },
  greeting: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  headerSub: { fontSize: 12, color: colors.textMuted },
  notifBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  notifIcon: { fontSize: 18 },
  notifDot: { position: 'absolute', top: 8, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, borderWidth: 1.5, borderColor: colors.bg },

  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.screenPadding, gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center' },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  onlineCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.screenPadding, marginBottom: 20, backgroundColor: colors.primary + '10', borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '25', padding: 14 },
  onlineLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  onlineTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  onlineSub: { fontSize: 10, color: colors.textSecondary },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.primary, padding: 2, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-end' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPadding, marginBottom: 10, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  flashCount: { backgroundColor: '#F97316', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flashCountText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  flashCard: { marginHorizontal: spacing.screenPadding, marginBottom: 10, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: '#FFC10730', padding: 14 },
  flashTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  flashBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFC10720', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  flashBadgeIcon: { fontSize: 18 },
  flashInfo: { flex: 1 },
  flashService: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  flashLocation: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  flashTime: { fontSize: 10, color: colors.textMuted },
  flashBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flashBudget: { fontSize: 16, fontWeight: '700', color: colors.primary },
  acceptBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  acceptBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  bookingCard: { marginHorizontal: spacing.screenPadding, marginBottom: 10, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  bookingTop: { flexDirection: 'row', alignItems: 'flex-start' },
  bookingAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bookingAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  bookingInfo: { flex: 1 },
  bookingClient: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  bookingJob: { fontSize: 12, color: colors.textSecondary, marginBottom: 3 },
  bookingMeta: { fontSize: 10, color: colors.textMuted },
  bookingBudget: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 6, textAlign: 'right' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '600' },
  bookingActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  declineBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  declineBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  acceptBookBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  acceptBookBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  quickActions: { flexDirection: 'row', paddingHorizontal: spacing.screenPadding, gap: 10, marginBottom: 20 },
  quickCard: { flex: 1, alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 16 },
  quickIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickIcon: { fontSize: 16 },
  quickLabel: { fontSize: 10, fontWeight: '600', color: colors.textPrimary },

  emptyCard: { alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 28, marginHorizontal: spacing.screenPadding, marginBottom: 20 },
  emptyEmoji: { fontSize: 32, marginBottom: 10, opacity: 0.5 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
