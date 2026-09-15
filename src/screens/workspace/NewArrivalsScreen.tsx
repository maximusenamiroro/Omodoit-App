import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, StatusBar, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { EASING, colors, spacing, useEntrance } from '../../theme';
import Icon from '../../components/common/Icon';
import PressableScale from '../../components/common/PressableScale';
import CardRowSkeleton from '../../components/common/CardRowSkeleton';
import { supabase } from '../../api/supabase';
import { CATEGORIES } from '../../lib/categories';

// A "new arrival" is a product or service a worker posted in the last
// 48 hours. It used to list reels instead, which meant the screen never
// showed anything a client could actually act on — no title, no price,
// and a View button that just opened the worker's profile.
interface Arrival {
  id: string;
  workerId: string;
  type: 'service' | 'product';
  title: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  category: string;
  emoji: string;
  color: string;
  posterName: string;
  time: string;
}

const CUTOFF_HOURS = 48;

const timeAgo = (date: string): string => {
  const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// Shared by this screen and the workspace search, so a product looks
// and behaves the same wherever a client runs into it.
export function mapProductRow(row: any, posterName: string): Arrival {
  const catMeta = CATEGORIES.find(c => c.name === row.category);
  const type: 'service' | 'product' = row.type === 'service' ? 'service' : 'product';
  return {
    id: row.id,
    workerId: row.worker_id,
    type,
    title: row.title || 'Untitled',
    description: row.description || null,
    price: row.price != null ? Number(row.price) : null,
    imageUrl: row.image_url || null,
    videoUrl: row.video_url || null,
    category: row.category || 'General',
    emoji: catMeta?.emoji || (type === 'service' ? '🛠️' : '📦'),
    color: catMeta?.color || colors.primary,
    posterName,
    time: timeAgo(row.created_at),
  };
}

export default function NewArrivalsScreen({ navigation }: any) {
  const entrance = useEntrance();
  const insets = useSafeAreaInsets();
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(entrance.stagger, [
      Animated.timing(headerOpacity, { toValue: 1, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(listOpacity, { toValue: 1, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
        Animated.spring(listSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
    ]).start();
  }, [headerOpacity, listOpacity, listSlide]);

  const loadArrivals = useCallback(async () => {
    setLoading(true);
    try {
      const cutoff = new Date(Date.now() - CUTOFF_HOURS * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('products')
        .select('id, worker_id, type, title, description, price, image_url, video_url, category, created_at')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Names come from a second query rather than a join: products has
      // no foreign-key relationship declared to profiles, so PostgREST
      // can't embed it, and asking it to returns an error instead of rows.
      const workerIds = [...new Set((data || []).map((p: any) => p.worker_id).filter(Boolean))];
      const nameMap: Record<string, string> = {};
      if (workerIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, full_name, business_name')
          .in('id', workerIds);
        (profileRows || []).forEach((p: any) => {
          nameMap[p.id] = p.business_name || p.full_name || 'A worker';
        });
      }

      setArrivals((data || []).map((row: any) =>
        mapProductRow(row, nameMap[row.worker_id] || 'A worker')));
    } catch (err) {
      console.error('Failed to load new arrivals:', err);
      setArrivals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadArrivals(); }, [loadArrivals]));

  const openArrival = (item: Arrival) => {
    navigation.navigate('ProductDetail', {
      product: {
        id: item.id,
        workerId: item.workerId,
        type: item.type,
        title: item.title,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        videoUrl: item.videoUrl,
        category: item.category,
        color: item.color,
        sellerName: item.posterName,
      },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="back" size={20} color={colors.white} />
        </PressableScale>
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
          <CardRowSkeleton actions={false} count={5} />
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
                <ArrivalRow key={item.id} item={item} onPress={() => openArrival(item)} />
              ))}
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// The action word is the whole point of the service/product split: you
// book a service, you order a product. Exported so search results show
// the same card.
export function ArrivalRow({ item, onPress }: { item: Arrival; onPress: () => void }) {
  const actionLabel = item.type === 'service' ? 'Book' : 'Order';
  return (
    <PressableScale style={styles.arrivalRow} onPress={onPress}>
      <View style={[styles.rowRing, { borderColor: item.color }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.rowImage} />
        ) : (
          <View style={[styles.rowAvatar, { backgroundColor: item.color + '15' }]}>
            <Text style={styles.rowEmoji}>{item.videoUrl ? '🎬' : item.emoji}</Text>
          </View>
        )}
      </View>

      <View style={styles.rowInfo}>
        <Text style={styles.rowCategory} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowPoster} numberOfLines={1}>@{item.posterName}</Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowPrice, { color: item.color }]}>
            {item.price != null ? `₦${item.price.toLocaleString()}` : 'Ask for price'}
          </Text>
          <Text style={styles.rowTime}>· {item.time}</Text>
        </View>
      </View>

      <View style={[styles.viewBtn, { backgroundColor: item.color + '15', borderColor: item.color + '30' }]}>
        <Text style={[styles.viewBtnText, { color: item.color }]}>{actionLabel}</Text>
      </View>
    </PressableScale>
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
    borderWidth: 2, marginRight: 14, overflow: 'hidden',
  },
  rowAvatar: {
    width: '100%', height: '100%', borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  rowImage: { width: '100%', height: '100%', borderRadius: 24 },
  rowEmoji: { fontSize: 22 },
  rowInfo: { flex: 1 },
  rowCategory: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  rowPoster: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowPrice: { fontSize: 12, fontWeight: '700' },
  rowTime: { fontSize: 10, color: colors.textMuted },
  viewBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, marginLeft: 10,
  },
  viewBtnText: { fontSize: 12, fontWeight: '600' },
});

export type { Arrival };
