import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import { useBroadcastPresence } from '../../lib/presence';
import { useBroadcastLocation } from '../../lib/tracking';
import { respondToBookingRequest } from '../../lib/db';

interface BookingRow {
  id: string;
  clientId: string;
  clientName: string;
  job: string;
  status: string;
  time: string;
  location: string;
}

export default function WorkstationScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  // Manual toggle controls whether this worker actually broadcasts
  // presence — a worker might keep the app open to check messages
  // without wanting new bookings, so "app is open" alone isn't
  // enough; this hook call is what makes the toggle below meaningful.
  useBroadcastPresence(isOnline ? user?.id : undefined, profile?.category || null, {
    subcategory: profile?.subcategory || null,
    name: profile?.full_name || null,
  });

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [sharingBookingId, setSharingBookingId] = useState<string | null>(null);
  // Worker-side of live tracking — built and channel-ready since
  // earlier this session, but nothing ever actually called this until
  // now, so a client watching TrackingScreen would wait forever with
  // no worker position ever arriving. A worker can only be en route to
  // one job at a time, so this is deliberately single-booking rather
  // than per-list-item (hooks can't be called inside a .map() anyway).
  const { permissionDenied: locationPermissionDenied } = useBroadcastLocation(sharingBookingId, !!sharingBookingId);
  const [stats, setStats] = useState({ active: 0, pending: 0, todayEarnings: 0 });

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
  }, [contentOpacity, contentSlide, headerOpacity]);

  const loadBookings = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Direct "Book Now" requests only. Flash Jobs are a different
      // thing with different urgency and their own dedicated screen
      // (FlashJobInboxScreen), so they're filtered out here rather than
      // mixed into the normal booking list.
      const { data: rows, error } = await supabase
        .from('hire_requests')
        .select('id, client_id, job_description, location, status, created_at')
        .eq('worker_id', user.id)
        .is('flash_batch_id', null)
        .in('status', ['pending', 'accepted', 'in_progress'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const clientIds = [...new Set((rows || []).map((r: any) => r.client_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', clientIds);
        (profileRows || []).forEach((p: any) => { nameMap[p.id] = p.full_name || 'Client'; });
      }

      const mapped: BookingRow[] = (rows || []).map((r: any) => ({
        id: r.id,
        clientId: r.client_id,
        clientName: nameMap[r.client_id] || 'Client',
        job: (r.job_description || '').split('\n')[0].slice(0, 60),
        status: r.status,
        time: timeAgo(r.created_at),
        location: r.location || '',
      }));

      setBookings(mapped);
      setStats({
        active: mapped.filter(b => b.status === 'accepted' || b.status === 'in_progress').length,
        pending: mapped.filter(b => b.status === 'pending').length,
        todayEarnings: 0, // no payments/earnings table wired yet
      });
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadBookings(); }, [loadBookings]));

  useEffect(() => {
    if (locationPermissionDenied) {
      Alert.alert(
        'Location Permission Needed',
        'Enable location access in your phone settings to share your location with the client.'
      );
      setSharingBookingId(null);
    }
  }, [locationPermissionDenied]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('workstation_' + user.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'hire_requests', filter: `worker_id=eq.${user.id}`,
      }, () => loadBookings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadBookings]);

  const respondToBooking = async (bookingId: string, newStatus: 'accepted' | 'declined') => {
    if (actioningId) return;
    setActioningId(bookingId);

    const result = await respondToBookingRequest(bookingId, newStatus);

    if (!result.ok) {
      if (result.reason === 'taken') {
        Alert.alert('No Longer Available', 'This request is no longer available — it may have already been taken.');
      } else {
        console.error('Failed to respond to booking:', result.error);
        Alert.alert('Something Went Wrong', 'Could not update this booking. Please check your connection and try again.');
      }
    }

    loadBookings();
    setActioningId(null);
  };

  // Nothing anywhere in the app could previously mark a job as done -
  // accept/decline existed, but there was no way to transition
  // accepted/in_progress into completed. That silently broke two
  // things downstream: the "Completed" tab on Orders always stayed
  // empty, and LeaveReviewScreen (only reachable from a completed
  // booking) could never actually be reached by anyone.
  const markJobComplete = async (bookingId: string) => {
    if (actioningId) return;
    setActioningId(bookingId);
    try {
      const { data: updateResult, error } = await supabase
        .from('hire_requests')
        .update({ status: 'completed' })
        .eq('id', bookingId)
        .in('status', ['accepted', 'in_progress'])
        .select('id')
        .maybeSingle();

      if (error) throw error;

      if (!updateResult) {
        Alert.alert('Could Not Update', 'This booking may have already changed status.');
        loadBookings();
        return;
      }

      // The client is notified by the on_booking_update database
      // trigger, which fires on every status change and carries the
      // "you can now leave a review" prompt. Inserting one here as
      // well sent the same message twice.

      loadBookings();
    } catch (err) {
      console.error('Failed to mark job complete:', err);
      Alert.alert('Something Went Wrong', 'Could not update this booking. Please check your connection and try again.');
    } finally {
      setActioningId(null);
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'Worker';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const getStatusStyle = (status: string) => {
    if (status === 'accepted' || status === 'in_progress') return { bg: colors.primary + '20', text: colors.primary };
    if (status === 'declined' || status === 'cancelled') return { bg: '#EF444420', text: '#EF4444' };
    return { bg: '#F59E0B20', text: '#F59E0B' };
  };

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const activeBookings = bookings.filter(b => b.status === 'accepted' || b.status === 'in_progress');

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
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentSlide }] }}>

          {/* Stats Cards — real counts, computed from actual bookings.
              Today's earnings stays at ₦0 until a payments table
              exists to compute it from. */}
          <View style={st.statsRow}>
            {[
              { value: stats.active.toString(), label: 'Active Jobs', icon: '📋', color: colors.primary },
              { value: '₦' + stats.todayEarnings, label: 'Today', icon: '💰', color: colors.flash },
              { value: stats.pending.toString(), label: 'Pending', icon: '⏳', color: '#F59E0B' },
            ].map((stat, i) => (
              <View key={i} style={st.statCard}>
                <Text style={st.statIcon}>{stat.icon}</Text>
                <Text style={[st.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={st.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Online toggle — now actually controls presence broadcast,
              not just local UI state */}
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

          {/* Pending Bookings */}
          <Text style={[st.sectionTitle, { paddingHorizontal: spacing.screenPadding, marginBottom: 10 }]}>
            📋 Booking Requests
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : bookings.length === 0 ? (
            <View style={st.emptyCard}>
              <Text style={st.emptyEmoji}>📋</Text>
              <Text style={st.emptyTitle}>No bookings yet</Text>
              <Text style={st.emptyDesc}>When clients book you, they will appear here</Text>
            </View>
          ) : (
            [...pendingBookings, ...activeBookings].map(booking => {
              const status = getStatusStyle(booking.status);
              return (
                <View key={booking.id} style={st.bookingCard}>
                  <View style={st.bookingTop}>
                    <View style={[st.bookingAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={st.bookingAvatarText}>{booking.clientName[0]}</Text>
                    </View>
                    <View style={st.bookingInfo}>
                      <Text style={st.bookingClient}>{booking.clientName}</Text>
                      <Text style={st.bookingJob} numberOfLines={1}>{booking.job}</Text>
                      <Text style={st.bookingMeta}>📍 {booking.location} · {booking.time}</Text>
                    </View>
                    <View style={[st.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[st.statusText, { color: status.text }]}>{booking.status}</Text>
                    </View>
                  </View>
                  {booking.status === 'pending' && (
                    <View style={st.bookingActions}>
                      <TouchableOpacity
                        style={st.declineBtn}
                        onPress={() => respondToBooking(booking.id, 'declined')}
                        disabled={actioningId === booking.id}
                        activeOpacity={0.85}
                      >
                        <Text style={st.declineBtnText}>{actioningId === booking.id ? '…' : 'Decline'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[st.acceptBookBtn, { backgroundColor: colors.primary }]}
                        onPress={() => respondToBooking(booking.id, 'accepted')}
                        disabled={actioningId === booking.id}
                        activeOpacity={0.85}
                      >
                        <Text style={st.acceptBookBtnText}>{actioningId === booking.id ? '…' : 'Accept'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {(booking.status === 'accepted' || booking.status === 'in_progress') && (
                    <View style={st.bookingActions}>
                      <TouchableOpacity
                        style={[st.acceptBookBtn, { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border }]}
                        onPress={() => navigation.navigate('Chat', { otherUserId: booking.clientId, otherUserName: booking.clientName, otherUserAvatar: null })}
                        activeOpacity={0.85}
                      >
                        <Text style={[st.acceptBookBtnText, { color: colors.textPrimary }]}>💬 Message</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[st.acceptBookBtn, { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: sharingBookingId === booking.id ? colors.primary + '50' : colors.border }]}
                        onPress={() => setSharingBookingId(sharingBookingId === booking.id ? null : booking.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[st.acceptBookBtnText, { color: sharingBookingId === booking.id ? colors.primary : colors.textPrimary }]}>
                          {sharingBookingId === booking.id ? '📍 Sharing…' : '📍 Share Location'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[st.acceptBookBtn, { backgroundColor: colors.primary }]}
                        onPress={() => Alert.alert(
                          'Mark as Complete',
                          `Confirm that the job for ${booking.clientName} is finished? They'll be notified and able to leave a review.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Mark Complete', onPress: () => { setSharingBookingId(prev => prev === booking.id ? null : prev); markJobComplete(booking.id); } },
                          ]
                        )}
                        disabled={actioningId === booking.id}
                        activeOpacity={0.85}
                      >
                        <Text style={st.acceptBookBtnText}>{actioningId === booking.id ? '…' : '✓ Complete'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* Quick Actions */}
          <Text style={[st.sectionTitle, { paddingHorizontal: spacing.screenPadding, marginTop: 8, marginBottom: 10 }]}>
            Quick Actions
          </Text>
          <View style={st.quickActionsGrid}>
            {[
              { icon: '🎬', label: 'Create Reel', color: colors.primary, route: 'CreateReel' },
              { icon: '📦', label: 'Add Product', color: colors.flash, route: 'AddProduct' },
              { icon: '📊', label: 'Analytics', color: '#8B5CF6', route: 'Analytics' },
              { icon: '💰', label: 'Earnings', color: '#06B6D4', route: 'Earnings' },
            ].map((action, i) => (
              <TouchableOpacity key={i} style={st.quickCardGrid} onPress={() => navigation.navigate(action.route)} activeOpacity={0.85}>
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

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.screenPadding, paddingTop: 12, paddingBottom: 12 },
  greeting: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  headerSub: { fontSize: 12, color: colors.textMuted },
  notifBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  notifIcon: { fontSize: 18 },

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

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },

  bookingCard: { marginHorizontal: spacing.screenPadding, marginBottom: 10, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  bookingTop: { flexDirection: 'row', alignItems: 'flex-start' },
  bookingAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bookingAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  bookingInfo: { flex: 1 },
  bookingClient: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  bookingJob: { fontSize: 12, color: colors.textSecondary, marginBottom: 3 },
  bookingMeta: { fontSize: 10, color: colors.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '600' },
  bookingActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  declineBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  declineBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  acceptBookBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  acceptBookBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  quickActions: { flexDirection: 'row', paddingHorizontal: spacing.screenPadding, gap: 10, marginBottom: 20 },
  quickCard: { flex: 1, alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 16 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.screenPadding, gap: 10, marginBottom: 20 },
  quickCardGrid: { width: '47%', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 16 },
  quickIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickIcon: { fontSize: 16 },
  quickLabel: { fontSize: 10, fontWeight: '600', color: colors.textPrimary },

  emptyCard: { alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 28, marginHorizontal: spacing.screenPadding, marginBottom: 20 },
  emptyEmoji: { fontSize: 32, marginBottom: 10, opacity: 0.5 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
