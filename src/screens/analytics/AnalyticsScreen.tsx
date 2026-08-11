import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';

interface Stats {
  totalBookings: number;
  accepted: number;
  declined: number;
  completed: number;
  totalReels: number;
  totalLikes: number;
  avgRating: number;
  reviewCount: number;
}

export default function AnalyticsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [bookingsRes, reelsRes, reviewsRes] = await Promise.all([
        supabase.from('hire_requests').select('status').eq('worker_id', user.id),
        supabase.from('reels').select('likes').eq('user_id', user.id),
        supabase.from('reviews').select('rating').eq('worker_id', user.id),
      ]);

      const bookings = bookingsRes.data || [];
      const reels = reelsRes.data || [];
      const reviews = reviewsRes.data || [];

      setStats({
        totalBookings: bookings.length,
        accepted: bookings.filter((b: any) => b.status === 'accepted' || b.status === 'in_progress' || b.status === 'completed').length,
        declined: bookings.filter((b: any) => b.status === 'declined').length,
        completed: bookings.filter((b: any) => b.status === 'completed').length,
        totalReels: reels.length,
        totalLikes: reels.reduce((s: number, r: any) => s + (r.likes || 0), 0),
        avgRating: reviews.length > 0 ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : 0,
        reviewCount: reviews.length,
      });
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  const respondedTotal = stats ? stats.accepted + stats.declined : 0;
  const acceptRate = respondedTotal > 0 ? Math.round((stats!.accepted / respondedTotal) * 100) : null;
  const avgLikes = stats && stats.totalReels > 0 ? Math.round(stats.totalLikes / stats.totalReels) : 0;

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={st.backText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>📊 Analytics</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading || !stats ? (
        <View style={st.loadingBox}><ActivityIndicator color="#8B5CF6" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>

          <Text style={st.sectionTitle}>Bookings</Text>
          <View style={st.statsRow}>
            <View style={st.statCard}>
              <Text style={st.statValue}>{stats.totalBookings}</Text>
              <Text style={st.statLabel}>Total Received</Text>
            </View>
            <View style={st.statCard}>
              <Text style={[st.statValue, { color: colors.primary }]}>{stats.completed}</Text>
              <Text style={st.statLabel}>Completed</Text>
            </View>
            <View style={st.statCard}>
              <Text style={st.statValue}>{acceptRate !== null ? `${acceptRate}%` : '—'}</Text>
              <Text style={st.statLabel}>Accept Rate</Text>
            </View>
          </View>

          <Text style={st.sectionTitle}>Reels</Text>
          <View style={st.statsRow}>
            <View style={st.statCard}>
              <Text style={st.statValue}>{stats.totalReels}</Text>
              <Text style={st.statLabel}>Posted</Text>
            </View>
            <View style={st.statCard}>
              <Text style={[st.statValue, { color: '#EF4444' }]}>{stats.totalLikes}</Text>
              <Text style={st.statLabel}>Total Likes</Text>
            </View>
            <View style={st.statCard}>
              <Text style={st.statValue}>{avgLikes}</Text>
              <Text style={st.statLabel}>Avg / Reel</Text>
            </View>
          </View>

          <Text style={st.sectionTitle}>Reputation</Text>
          <View style={st.statsRow}>
            <View style={[st.statCard, { flex: 1 }]}>
              <Text style={[st.statValue, { color: '#F59E0B' }]}>{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'} ⭐</Text>
              <Text style={st.statLabel}>Average Rating ({stats.reviewCount} review{stats.reviewCount === 1 ? '' : 's'})</Text>
            </View>
          </View>

          <View style={st.noteCard}>
            <Text style={st.noteText}>
              These numbers are computed directly from your real bookings, reels, and reviews — nothing here is estimated.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  statLabel: { fontSize: 9, color: colors.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },

  noteCard: { backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 8 },
  noteText: { fontSize: 11, color: colors.textMuted, lineHeight: 17, textAlign: 'center' },
});
