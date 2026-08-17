import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import { supabase } from '../../api/supabase';

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

type SortOption = 'rating' | 'reviews' | 'nearest';

interface WorkerRow {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  location: string;
  experience: string;
  verified: boolean;
  bio: string;
}

// Workers arrive a page at a time. A popular trade in a city of this
// size is thousands of people; the list used to fetch all of them.
const WORKER_PAGE_SIZE = 20;

export default function WorkerListScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { categoryName, subcategoryName, color } = route.params;
  const accentColor = color || colors.primary;

  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);

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
  }, [headerOpacity, listOpacity, listSlide]);

  const loadWorkers = useCallback(async (offset: number) => {
    // One call returns the page of workers with their ratings already
    // averaged. This was two unbounded queries: every worker in the
    // trade, then every review belonging to any of them.
    const { data, error } = await supabase.rpc('list_workers', {
      p_category: categoryName && categoryName !== 'All' ? categoryName : null,
      p_subcategory: subcategoryName && subcategoryName !== 'General Workers' ? subcategoryName : null,
      p_limit: WORKER_PAGE_SIZE,
      p_offset: offset,
    });

    if (error) throw error;

    return (data || []).map((w: any): WorkerRow => ({
      id: w.id,
      name: w.full_name || w.business_name || 'Worker',
      rating: Number(w.rating_avg) || 0,
      reviews: Number(w.review_count) || 0,
      location: w.location || 'Location not set',
      experience: w.experience || 'Not specified',
      verified: w.verification_status === 'verified' || w.verification_status === 'basic',
      bio: w.business_name
        ? `${w.business_name} — ${subcategoryName || categoryName}`
        : `Available for ${subcategoryName || categoryName} jobs.`,
    }));
  }, [categoryName, subcategoryName]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReachedEnd(false);

    loadWorkers(0)
      .then(rows => {
        if (cancelled) return;
        setWorkers(rows);
        setReachedEnd(rows.length < WORKER_PAGE_SIZE);
      })
      .catch(err => {
        console.error('Failed to load workers:', err);
        if (!cancelled) setWorkers([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [loadWorkers]);

  const loadMoreWorkers = useCallback(async () => {
    if (loading || loadingMore || reachedEnd) return;
    setLoadingMore(true);
    try {
      const rows = await loadWorkers(workers.length);
      setWorkers(prev => {
        const seen = new Set(prev.map(w => w.id));
        return [...prev, ...rows.filter((r: WorkerRow) => !seen.has(r.id))];
      });
      setReachedEnd(rows.length < WORKER_PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more workers:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadWorkers, workers.length, loading, loadingMore, reachedEnd]);

  const sortedWorkers = React.useMemo(() => {
    const sorted = [...workers];
    if (sortBy === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    if (sortBy === 'reviews') sorted.sort((a, b) => b.reviews - a.reviews);
    // 'nearest' has no real distance data yet without device location —
    // falls back to the existing order rather than pretending to sort.
    return sorted;
  }, [workers, sortBy]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{subcategoryName}</Text>
          <Text style={styles.headerSub}>{categoryName}</Text>
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      {/* Sort options */}
      <Animated.View style={[styles.sortRow, { opacity: headerOpacity }]}>
        {([['rating', '⭐ Rating'], ['reviews', '💬 Reviews'], ['nearest', '📍 Nearest']] as [SortOption, string][]).map(([key, label]) => (
          <PressableScale
            key={key}
            style={[styles.sortChip, sortBy === key && { backgroundColor: accentColor + '15', borderColor: accentColor + '40' }]}
            onPress={() => setSortBy(key)}
          >
            <Text style={[styles.sortText, sortBy === key && { color: accentColor, fontWeight: '700' }]}>{label}</Text>
          </PressableScale>
        ))}
      </Animated.View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={accentColor} />
        </View>
      ) : (
        <>
          <Text style={styles.resultCount}>{sortedWorkers.length} worker{sortedWorkers.length === 1 ? '' : 's'} found</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
            onScroll={({ nativeEvent: e }) => {
              // Within a screen of the bottom: fetch the next page.
              const nearBottom =
                e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - e.layoutMeasurement.height;
              if (nearBottom) loadMoreWorkers();
            }}
            scrollEventThrottle={200}
          >
            <Animated.View style={{ opacity: listOpacity, transform: [{ translateY: listSlide }], paddingHorizontal: spacing.screenPadding }}>
              {sortedWorkers.length === 0 && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No workers in this category yet.</Text>
                  <Text style={styles.emptySubtext}>Check back soon, or try Flash Job to reach nearby workers instantly.</Text>
                </View>
              )}
              {sortedWorkers.map((worker) => (
                <PressableScale
                  key={worker.id}
                  style={styles.workerCard}
                  onPress={() => navigation.navigate('WorkerPublicProfile', { worker, color: accentColor, subcategoryName })}
                >
                  <View style={styles.workerTop}>
                    <View style={[styles.workerAvatar, { backgroundColor: accentColor }]}>
                      <Text style={styles.workerAvatarText}>{getInitials(worker.name)}</Text>
                    </View>
                    <View style={styles.workerInfo}>
                      <View style={styles.workerNameRow}>
                        <Text style={styles.workerName}>{worker.name}</Text>
                        {worker.verified && (
                          <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>
                        )}
                      </View>
                      <Text style={styles.workerLocation}>📍 {worker.location}</Text>
                      <View style={styles.workerRatingRow}>
                        <Text style={styles.workerStar}>⭐</Text>
                        <Text style={styles.workerRating}>{worker.rating > 0 ? worker.rating.toFixed(1) : '—'}</Text>
                        <Text style={styles.workerReviews}>({worker.reviews} review{worker.reviews === 1 ? '' : 's'})</Text>
                        <Text style={styles.workerExp}>· {worker.experience}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.workerBio} numberOfLines={2}>{worker.bio}</Text>
                  <View style={styles.workerActions}>
                    <PressableScale
                      style={[styles.bookBtn, { backgroundColor: accentColor }]}
                      onPress={() => navigation.navigate('HireWorker', { worker, subcategoryName })}
                    >
                      <Text style={styles.bookBtnText}>📋 Book Now</Text>
                    </PressableScale>
                    <PressableScale
                      style={styles.messageBtn}
                      onPress={() => navigation.navigate('Chat', { otherUserId: worker.id, otherUserName: worker.name, otherUserAvatar: null })}
                    >
                      <Text style={styles.messageBtnText}>💬 Message</Text>
                    </PressableScale>
                  </View>
                </PressableScale>
              ))}
              {loadingMore && <ActivityIndicator color={colors.primary} style={styles.moreLoader} />}
              {reachedEnd && workers.length >= WORKER_PAGE_SIZE && (
                <Text style={styles.endOfList}>That's everyone in this trade.</Text>
              )}
            </Animated.View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  moreLoader: { marginVertical: 16 },
  endOfList: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginVertical: 16 },
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  sortRow: { flexDirection: 'row', paddingHorizontal: spacing.screenPadding, gap: 8, paddingVertical: 12 },
  sortChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  sortText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  resultCount: { fontSize: 11, color: colors.textMuted, paddingHorizontal: spacing.screenPadding, marginBottom: 8 },
  emptyBox: { paddingVertical: 60, alignItems: 'center', paddingHorizontal: 20 },
  emptyText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  emptySubtext: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  workerCard: { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  workerTop: { flexDirection: 'row', marginBottom: 10 },
  workerAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  workerAvatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  workerInfo: { flex: 1 },
  workerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  workerName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  verifiedBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.info, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { fontSize: 8, fontWeight: '700', color: colors.white },
  workerLocation: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  workerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  workerStar: { fontSize: 11 },
  workerRating: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  workerReviews: { fontSize: 10, color: colors.textMuted },
  workerExp: { fontSize: 10, color: colors.textMuted },
  workerBio: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: 12 },
  workerActions: { flexDirection: 'row', gap: 10 },
  bookBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  bookBtnText: { fontSize: 13, fontWeight: '600', color: colors.white },
  messageBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  messageBtnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
});
