import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { supabase } from '../../api/supabase';
import { CATEGORIES } from '../../lib/categories';

interface Arrival {
  id: string;
  workerId: string;
  category: string;
  emoji: string;
  color: string;
  posterName: string;
  time: string;
}

const timeAgo = (date: string): string => {
  const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function NewArrivalsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(listOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(listSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const loadArrivals = useCallback(async () => {
    setLoading(true);
    try {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('reels')
        .select('id, created_at, profiles(id, full_name, category)')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setArrivals((data || []).map((reel: any) => {
        const posterCategory = reel.profiles?.category;
        const catMeta = CATEGORIES.find(c => c.name === posterCategory);
        return {
          id: reel.id,
          workerId: reel.profiles?.id,
          category: posterCategory || 'General',
          emoji: catMeta?.emoji || '✨',
          color: catMeta?.color || colors.primary,
          posterName: reel.profiles?.full_name || 'A worker',
          time: timeAgo(reel.created_at),
        };
      }));
    } catch (err) {
      console.error('Failed to load new arrivals:', err);
      setArrivals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadArrivals(); }, [loadArrivals]));

  const viewProfile = async (workerId: string) => {
    if (!workerId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, location, experience, verification_status, category, subcategory')
        .eq('id', workerId)
        .maybeSingle();

      if (error || !data) return;

      const { data: reviewRows } = await supabase.from('reviews').select('rating').eq('worker_id', workerId);
      const ratings = (reviewRows || []).map((r: any) => r.rating);
      const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
      const catMeta = CATEGORIES.find(c => c.name === data.category);

      navigation.navigate('WorkerPublicProfile', {
        worker: {
          id: data.id,
          name: data.full_name || 'Worker',
          rating: avgRating,
          reviews: ratings.length,
          location: data.location || 'Location not set',
          experience: data.experience || 'Not specified',
          verified: data.verification_status === 'verified' || data.verification_status === 'basic',
          bio: `Available for ${data.subcategory || data.category || 'various'} jobs.`,
        },
        color: catMeta?.color || colors.primary,
        subcategoryName: data.subcategory || data.category,
      });
    } catch (err) {
      console.error('Failed to load worker profile:', err);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>New Arrivals</Text>
          <Text style={styles.headerSub}>Posted in the last 48 hours</Text>
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      <Animated.View style={[styles.statsBanner, { opacity: headerOpacity }]}>
        <Text style={styles.statsText}>
          {loading ? 'Loading…' : `${arrivals.length} new listing${arrivals.length === 1 ? '' : 's'}`}
        </Text>
      </Animated.View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>
          {arrivals.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🆕</Text>
              <Text style={styles.emptyTitle}>Nothing new right now</Text>
              <Text style={styles.emptySub}>Check back soon for the latest posts.</Text>
            </View>
          ) : (
            <Animated.View style={{
              opacity: listOpacity, transform: [{ translateY: listSlide }],
              paddingHorizontal: spacing.screenPadding,
            }}>
              {arrivals.map(item => (
                <TouchableOpacity key={item.id} style={styles.arrivalRow} onPress={() => viewProfile(item.workerId)} activeOpacity={0.85}>
                  <View style={[styles.rowRing, { borderColor: item.color }]}>
                    <View style={[styles.rowAvatar, { backgroundColor: item.color + '15' }]}>
                      <Text style={styles.rowEmoji}>{item.emoji}</Text>
                    </View>
                  </View>

                  <View style={styles.rowInfo}>
                    <Text style={styles.rowCategory}>{item.category}</Text>
                    <Text style={styles.rowPoster}>@{item.posterName}</Text>
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowTime}>{item.time}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.viewBtn, { backgroundColor: item.color + '15', borderColor: item.color + '30' }]} onPress={() => viewProfile(item.workerId)} activeOpacity={0.85}>
                    <Text style={[styles.viewBtnText, { color: item.color }]}>View</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  statsBanner: {
    marginHorizontal: spacing.screenPadding, marginVertical: 12,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.primary + '10', borderWidth: 1, borderColor: colors.primary + '25',
  },
  statsText: { fontSize: 12, fontWeight: '600', color: colors.primary, textAlign: 'center' },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 12, opacity: 0.4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  arrivalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  rowRing: {
    width: 52, height: 52, borderRadius: 26, padding: 2,
    borderWidth: 2, marginRight: 14,
  },
  rowAvatar: {
    width: '100%', height: '100%', borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  rowEmoji: { fontSize: 22 },
  rowInfo: { flex: 1 },
  rowCategory: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  rowPoster: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowTime: { fontSize: 10, color: colors.textMuted },
  viewBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, marginLeft: 10,
  },
  viewBtnText: { fontSize: 12, fontWeight: '600' },
});
