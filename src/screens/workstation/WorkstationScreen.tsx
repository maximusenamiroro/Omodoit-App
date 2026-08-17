import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, StatusBar, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { EASING, colors, spacing } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import { useBroadcastPresence } from '../../lib/presence';
import { useBroadcastLocation } from '../../lib/tracking';
import { respondToBookingRequest } from '../../lib/db';
import BookingCard from '../../components/common/BookingCard';
import OrderCard from '../../components/common/OrderCard';
import {
  fetchWorkerBookings, fetchWorkerOrders, setOrderStatus,
  type BookingRow, type ProductOrderRow,
} from '../../lib/workstation';

// The dashboard is a summary, not a list. Showing every booking pushed
// Quick Actions off the bottom of the screen for anyone with real work
// coming in, so it shows this many and links to the full page.
const PREVIEW_COUNT = 2;

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
  const [orders, setOrders] = useState<ProductOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
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
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, easing: EASING.OUT, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 300, easing: EASING.OUT, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
    ]).start();
  }, [contentOpacity, contentSlide, headerOpacity]);

  const loadBookings = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const mapped = await fetchWorkerBookings(user.id);
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

  const loadOrders = useCallback(async () => {
    if (!user?.id) return;
    setOrdersLoading(true);
    try {
      setOrders(await fetchWorkerOrders(user.id, { limit: 20 }));
    } catch (err) {
      console.error('Failed to load product orders:', err);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadBookings(); loadOrders(); }, [loadBookings, loadOrders]));

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
      // Product orders live in their own table and are filtered by
      // product, not worker — no server-side filter is possible here, so
      // this listens to inserts and lets loadOrders decide what's ours.
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
      }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadBookings, loadOrders]);

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

  // Pending first: those are the ones needing a decision.
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const activeBookings = bookings.filter(b => b.status === 'accepted' || b.status === 'in_progress');
  const orderedBookings = [...pendingBookings, ...activeBookings];
  const previewBookings = orderedBookings.slice(0, PREVIEW_COUNT);
  const previewOrders = orders.slice(0, PREVIEW_COUNT);

  const advanceOrder = async (order: ProductOrderRow, next: 'accepted' | 'completed' | 'cancelled') => {
    if (actioningId) return;
    setActioningId(order.id);
    try {
      const allowedFrom = next === 'completed' ? ['accepted', 'in_progress'] : ['pending'];
      const changed = await setOrderStatus(order.id, next, allowedFrom);
      if (!changed) {
        Alert.alert('Could Not Update', 'This order may have already changed status.');
      } else {
        setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, status: next } : o)));
      }
    } catch (err) {
      console.error('Failed to update order:', err);
      Alert.alert('Something Went Wrong', 'Could not update this order. Please try again.');
    } finally {
      setActioningId(null);
    }
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
          <PressableScale style={st.notifBtn} onPress={() => navigation.navigate('Notifications')}>
            <Text style={st.notifIcon}>🔔</Text>
          </PressableScale>
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
          <PressableScale style={st.onlineCard} onPress={() => setIsOnline(!isOnline)}>
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
          </PressableScale>

          {/* Booking requests — first two only, full list one tap away */}
          <View style={st.sectionHead}>
            <Text style={st.sectionTitle}>📋 Booking Requests</Text>
            {orderedBookings.length > 0 && (
              <PressableScale onPress={() => navigation.navigate('AllBookings')}>
                <Text style={st.seeAll}>See all ({orderedBookings.length})</Text>
              </PressableScale>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : previewBookings.length === 0 ? (
            <View style={st.emptyCard}>
              <Text style={st.emptyEmoji}>📋</Text>
              <Text style={st.emptyTitle}>No bookings yet</Text>
              <Text style={st.emptyDesc}>When clients book you, they will appear here</Text>
            </View>
          ) : (
            <>
              {previewBookings.map(booking => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  busy={actioningId === booking.id}
                  onRespond={respondToBooking}
                  onMessage={b => navigation.navigate('Chat', {
                    otherUserId: b.clientId, otherUserName: b.clientName, otherUserAvatar: null,
                  })}
                  onToggleShare={id => setSharingBookingId(sharingBookingId === id ? null : id)}
                  sharing={sharingBookingId === booking.id}
                  onComplete={b => Alert.alert(
                    'Mark as Complete',
                    `Confirm that the job for ${b.clientName} is finished? They'll be notified and able to leave a review.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Mark Complete', onPress: () => { setSharingBookingId(prev => prev === b.id ? null : prev); markJobComplete(b.id); } },
                    ]
                  )}
                />
              ))}
              {orderedBookings.length > PREVIEW_COUNT && (
                <PressableScale style={st.seeMoreBtn} onPress={() => navigation.navigate('AllBookings')}>
                  <Text style={st.seeMoreText}>
                    See {orderedBookings.length - PREVIEW_COUNT} more booking{orderedBookings.length - PREVIEW_COUNT === 1 ? '' : 's'} →
                  </Text>
                </PressableScale>
              )}
            </>
          )}

          {/* Product orders — same two-then-see-more shape as bookings */}
          <View style={[st.sectionHead, { marginTop: 8 }]}>
            <Text style={st.sectionTitle}>🛒 Product Orders</Text>
            {orders.length > 0 && (
              <PressableScale onPress={() => navigation.navigate('AllOrders')}>
                <Text style={st.seeAll}>See all ({orders.length})</Text>
              </PressableScale>
            )}
          </View>

          {ordersLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : previewOrders.length === 0 ? (
            <View style={st.emptyCard}>
              <Text style={st.emptyEmoji}>🛒</Text>
              <Text style={st.emptyTitle}>No orders yet</Text>
              <Text style={st.emptyDesc}>Orders for the products you post will appear here</Text>
            </View>
          ) : (
            <>
              {previewOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  busy={actioningId === order.id}
                  onAdvance={advanceOrder}
                  onMessage={o => navigation.navigate('Chat', {
                    otherUserId: o.buyerId, otherUserName: o.buyerName, otherUserAvatar: null,
                  })}
                />
              ))}
              {orders.length > PREVIEW_COUNT && (
                <PressableScale style={st.seeMoreBtn} onPress={() => navigation.navigate('AllOrders')}>
                  <Text style={st.seeMoreText}>
                    See {orders.length - PREVIEW_COUNT} more order{orders.length - PREVIEW_COUNT === 1 ? '' : 's'} →
                  </Text>
                </PressableScale>
              )}
            </>
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
              <PressableScale key={i} style={st.quickCardGrid} onPress={() => navigation.navigate(action.route)}>
                <View style={[st.quickIconBg, { backgroundColor: action.color + '15' }]}>
                  <Text style={st.quickIcon}>{action.icon}</Text>
                </View>
                <Text style={st.quickLabel}>{action.label}</Text>
              </PressableScale>
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
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, marginBottom: 10 },
  seeAll: { fontSize: 12, fontWeight: '600', color: colors.primary },
  seeMoreBtn: { marginHorizontal: spacing.screenPadding, marginBottom: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  seeMoreText: { fontSize: 12, fontWeight: '700', color: colors.primary },
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
