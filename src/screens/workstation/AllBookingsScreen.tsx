import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  StatusBar, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import CardRowSkeleton from '../../components/common/CardRowSkeleton';
import StaggerIn from '../../components/common/StaggerIn';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import { respondToBookingRequest } from '../../lib/db';
import BookingCard from '../../components/common/BookingCard';
import { fetchWorkerBookings, type BookingRow } from '../../lib/workstation';

// Every booking this worker has ever had, including finished ones —
// the dashboard only shows the two most recent open ones.
//
// Paged rather than loaded whole: a busy worker accumulates hundreds of
// rows, and each page is one round trip plus one profile lookup.
const PAGE_SIZE = 20;

const FILTERS = [
  { key: 'open', label: 'Active', statuses: ['pending', 'accepted', 'in_progress'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
  { key: 'all', label: 'All', statuses: null },
] as const;

export default function AllBookingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [filter, setFilter] = useState<typeof FILTERS[number]['key']>('open');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const activeFilter = FILTERS.find(f => f.key === filter)!;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setReachedEnd(false);
    try {
      const rows = await fetchWorkerBookings(user.id, {
        statuses: activeFilter.statuses,
        limit: PAGE_SIZE,
      });
      setBookings(rows);
      setReachedEnd(rows.length < PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeFilter.statuses]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!user?.id || loading || loadingMore || reachedEnd) return;
    setLoadingMore(true);
    try {
      const rows = await fetchWorkerBookings(user.id, {
        statuses: activeFilter.statuses,
        limit: PAGE_SIZE,
        offset: bookings.length,
      });
      // Guard against a row arriving twice when something was inserted
      // between pages and shifted the offset.
      setBookings(prev => {
        const seen = new Set(prev.map(b => b.id));
        return [...prev, ...rows.filter(r => !seen.has(r.id))];
      });
      setReachedEnd(rows.length < PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more bookings:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const respond = async (bookingId: string, newStatus: 'accepted' | 'declined') => {
    if (actioningId) return;
    setActioningId(bookingId);
    const result = await respondToBookingRequest(bookingId, newStatus);
    if (!result.ok) {
      Alert.alert(
        result.reason === 'taken' ? 'No Longer Available' : 'Something Went Wrong',
        result.reason === 'taken'
          ? 'This request is no longer available — it may have already been taken.'
          : 'Could not update this booking. Please check your connection and try again.'
      );
    }
    setActioningId(null);
    load();
  };

  const complete = (booking: BookingRow) => {
    Alert.alert(
      'Mark as Complete',
      `Confirm that the job for ${booking.clientName} is finished? They'll be notified and able to leave a review.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Complete',
          onPress: async () => {
            setActioningId(booking.id);
            try {
              const { data, error } = await supabase
                .from('hire_requests')
                .update({ status: 'completed' })
                .eq('id', booking.id)
                .in('status', ['accepted', 'in_progress'])
                .select('id')
                .maybeSingle();
              if (error) throw error;
              if (!data) Alert.alert('Could Not Update', 'This booking may have already changed status.');
            } catch (err) {
              console.error('Failed to mark job complete:', err);
              Alert.alert('Something Went Wrong', 'Could not update this booking. Please try again.');
            } finally {
              setActioningId(null);
              load();
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <PressableScale style={st.backBtn} onPress={() => navigation.goBack()}>
          <Text style={st.backText}>←</Text>
        </PressableScale>
        <Text style={st.headerTitle}>All Bookings</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={st.filterRow}>
        {FILTERS.map(f => (
          <PressableScale
            key={f.key}
            style={[st.filterChip, filter === f.key && st.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[st.filterText, filter === f.key && st.filterTextActive]}>{f.label}</Text>
          </PressableScale>
        ))}
      </View>

      {loading ? (
        <CardRowSkeleton />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={st.emptyBox}>
              <Text style={st.emptyEmoji}>📋</Text>
              <Text style={st.emptyTitle}>Nothing here yet</Text>
              <Text style={st.emptySub}>Bookings from clients will show up on this page.</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item, index }) => (
            <StaggerIn index={index}>
              <BookingCard
                booking={item}
                busy={actioningId === item.id}
                onRespond={respond}
                onComplete={complete}
                onMessage={b => navigation.navigate('Chat', {
                  otherUserId: b.clientId, otherUserName: b.clientName, otherUserAvatar: null,
                })}
              />
            </StaggerIn>
          )}
      />
    )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.screenPadding, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  filterTextActive: { color: colors.primary },

  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 12, opacity: 0.4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
