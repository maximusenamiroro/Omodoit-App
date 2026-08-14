import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Animated, StatusBar, Platform,
  Dimensions, LayoutAnimation, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import { CATEGORIES } from '../../lib/categories';
import { useOnlinePresence } from '../../lib/presence';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CAT_CARD_W = (SCREEN_W - spacing.screenPadding * 2 - 24) / 3;
const VISIBLE_CAT_ROWS = 3;

const MAIN_CATEGORIES = CATEGORIES;


const VISIBLE_ARRIVALS = 5;

function DraggableFab({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_W - 74, y: SCREEN_H - bottom - 80 })).current;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
    onPanResponderGrant: () => {
      pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gs) => {
      pan.flattenOffset();
      const currentX = (pan.x as any)._value;
      const currentY = (pan.y as any)._value;
      const snapX = currentX < SCREEN_W / 2 ? 16 : SCREEN_W - 74;
      const clampedY = Math.max(60, Math.min(currentY, SCREEN_H - bottom - 80));
      if (Math.abs(gs.dx) < 10 && Math.abs(gs.dy) < 10) {
        Animated.spring(pan, { toValue: { x: snapX, y: clampedY }, damping: 15, stiffness: 150, useNativeDriver: false }).start();
        onPress();
        return;
      }
      Animated.spring(pan, { toValue: { x: snapX, y: clampedY }, damping: 15, stiffness: 150, useNativeDriver: false }).start();
    },
  }), []);

  return (
    <Animated.View style={[fabSt.fab, { transform: pan.getTranslateTransform() }]} {...panResponder.panHandlers}>
      <View style={fabSt.fabInner}>
        <Text style={fabSt.fabIcon}>⚡</Text>
      </View>
      <Text style={fabSt.fabLabel}>Flash Job</Text>
    </Animated.View>
  );
}

const fabSt = StyleSheet.create({
  fab: { position: 'absolute', alignItems: 'center', zIndex: 20 },
  fabInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#FFC107', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8, borderWidth: 2, borderColor: '#FFC10760' },
  fabIcon: { fontSize: 26 },
  fabLabel: { fontSize: 9, fontWeight: '700', color: '#FFC107', marginTop: 4 },
});

export default function WorkspaceScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [newArrivals, setNewArrivals] = useState<any[]>([]);
  const [arrivalsLoading, setArrivalsLoading] = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const searchSlide = useRef(new Animated.Value(20)).current;
  const arrivalsOpacity = useRef(new Animated.Value(0)).current;
  const liveOpacity = useRef(new Animated.Value(0)).current;
  const liveSlide = useRef(new Animated.Value(30)).current;
  const generalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(searchSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(arrivalsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(liveOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(liveSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
      Animated.timing(generalOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  // "New Arrivals" — reels posted by workers in the last 48 hours,
  // matching the "48h only" badge. Real data only; a section this
  // visible showing named people who don't exist is exactly the kind
  // of fake social proof that damages trust once anyone notices.
  useEffect(() => {
    const fetchArrivals = async () => {
      setArrivalsLoading(true);
      try {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('reels')
          .select('id, description, type, created_at, profiles(full_name, category)')
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;

        const mapped = (data || []).map((reel: any) => {
          const posterCategory = reel.profiles?.category || reel.type || 'General';
          const catMeta = MAIN_CATEGORIES.find(c =>
            c.name.toLowerCase().includes((posterCategory || '').toLowerCase().split(' ')[0])
          );
          return {
            id: reel.id,
            category: posterCategory,
            emoji: catMeta?.emoji || '✨',
            posterName: reel.profiles?.full_name || 'A worker',
            color: catMeta?.color || colors.primary,
          };
        });

        setNewArrivals(mapped);
      } catch (err) {
        console.error('Failed to load new arrivals:', err);
        setNewArrivals([]);
      } finally {
        setArrivalsLoading(false);
      }
    };

    fetchArrivals();
  }, []);

  // "Live Now" badge on category cards — now driven by real Presence
  // (see src/lib/presence.ts) instead of polling the database every
  // 60 seconds. Updates instantly the moment a worker opens/closes
  // their app, and costs nothing per update since it rides the
  // existing websocket connection rather than a database query.
  const { onlineCategories } = useOnlinePresence();

  const filteredCategories = searchQuery.trim()
    ? MAIN_CATEGORIES.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : MAIN_CATEGORIES;

  const visibleCategories = showAllCategories
    ? filteredCategories
    : filteredCategories.slice(0, VISIBLE_CAT_ROWS * 3);

  const hasMoreCategories = filteredCategories.length > VISIBLE_CAT_ROWS * 3;

  const toggleCategories = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAllCategories(!showAllCategories);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>

        {/* HEADER */}
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Orders')} activeOpacity={0.7}>
            <Text style={styles.headerIconText}>📋</Text>
            <Text style={styles.headerIconLabel}>Orders</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Workspace</Text>
          </View>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
            <Text style={styles.headerIconText}>🔔</Text>
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </Animated.View>

        {/* SEARCH */}
        <Animated.View style={[styles.searchContainer, { opacity: headerOpacity, transform: [{ translateY: searchSlide }] }]}>
          <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search business..."
              placeholderTextColor={colors.textMuted}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* NEW ARRIVALS */}
        {(arrivalsLoading || newArrivals.length > 0) && (
          <Animated.View style={{ opacity: arrivalsOpacity }}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>🆕 New Arrivals</Text>
                <View style={styles.badge48h}><Text style={styles.badge48hText}>48h only</Text></View>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('NewArrivals')} activeOpacity={0.7}>
                <Text style={styles.seeAll}>See All →</Text>
              </TouchableOpacity>
            </View>

            {arrivalsLoading ? (
              <View style={[styles.arrivalsScroll, { flexDirection: 'row' }]}>
                {[1, 2, 3].map(i => (
                  <View key={i} style={styles.arrivalItem}>
                    <View style={[styles.storyRing, { borderColor: colors.border, opacity: 0.4 }]}>
                      <View style={[styles.storyInner, { backgroundColor: colors.bgCard }]} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.arrivalsScroll}>
                {newArrivals.slice(0, VISIBLE_ARRIVALS).map(item => (
                  <TouchableOpacity key={item.id} style={styles.arrivalItem} activeOpacity={0.85}>
                    <View style={styles.storyRing}>
                      <View style={styles.storyInner}>
                        <View style={[styles.storyAvatar, { backgroundColor: item.color + '20' }]}>
                          <Text style={styles.storyEmoji}>{item.emoji}</Text>
                        </View>
                      </View>
                      <View style={styles.storyBadge}><Text style={styles.storyBadgeText}>{item.emoji}</Text></View>
                    </View>
                    <Text style={styles.arrivalCategory} numberOfLines={1}>{item.category}</Text>
                    <Text style={styles.arrivalPoster} numberOfLines={1}>@{item.posterName.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
                {newArrivals.length > VISIBLE_ARRIVALS && (
                  <TouchableOpacity style={styles.seeMoreCircle} onPress={() => navigation.navigate('NewArrivals')} activeOpacity={0.85}>
                    <View style={styles.seeMoreRing}>
                      <View style={styles.seeMoreInner}>
                        <Text style={styles.seeMoreCount}>+{newArrivals.length - VISIBLE_ARRIVALS}</Text>
                      </View>
                    </View>
                    <Text style={styles.seeMoreLabel}>See more</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {/* LIVE BUSINESS */}
        <Animated.View style={{ opacity: liveOpacity, transform: [{ translateY: liveSlide }] }}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Live Business</Text>
              <View style={styles.livePulse} />
            </View>
          </View>

          <View style={styles.categoryGrid}>
            {visibleCategories.map((cat, i) => {
              const hasLive = onlineCategories.has(cat.name);
              return (
                <TouchableOpacity key={i} style={[styles.categoryCard, hasLive && styles.categoryCardLive]}
                  onPress={() => navigation.navigate('SubCategories', { categoryName: cat.name })} activeOpacity={0.85}>
                  {hasLive && <View style={styles.liveDot} />}
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text style={styles.categoryName} numberOfLines={2}>{cat.name}</Text>
                  {hasLive && <Text style={styles.liveNowText}>Live Now</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {hasMoreCategories && !searchQuery.trim() && (
            <TouchableOpacity style={styles.seeAllCatsBtn} onPress={toggleCategories} activeOpacity={0.85}>
              <Text style={styles.seeAllCatsText}>{showAllCategories ? 'Show Less ↑' : 'See All Categories ↓'}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* GENERAL WORKERS */}
        <Animated.View style={{ opacity: generalOpacity }}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.screenPadding, marginBottom: 10, marginTop: 4 }]}>General Workers</Text>
          <TouchableOpacity style={styles.actionRowBtn}
            onPress={() => navigation.navigate('WorkerList', { categoryName: 'All', subcategoryName: 'General Workers', color: colors.primary })} activeOpacity={0.85}>
            <View style={styles.actionRowLeft}>
              <View style={[styles.actionRowIcon, { backgroundColor: colors.flash + '15' }]}>
                <Text style={styles.actionRowEmoji}>👷</Text>
              </View>
              <View>
                <Text style={styles.actionRowTitle}>View All General Workers</Text>
                <Text style={styles.actionRowDesc}>Browse workers across all categories</Text>
              </View>
            </View>
            <Text style={styles.actionRowArrow}>→</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>

      {/* DRAGGABLE FLASH JOB FAB */}
      <DraggableFab onPress={() => navigation.navigate('FlashJob')} bottom={Platform.OS === 'ios' ? insets.bottom + 90 : 78} />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.screenPadding, paddingTop: 8, paddingBottom: 12 },
  headerIconBtn: { alignItems: 'center', width: 44 },
  headerIconText: { fontSize: 20 },
  headerIconLabel: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  notifDot: { position: 'absolute', top: -2, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, borderWidth: 1.5, borderColor: colors.bg },

  searchContainer: { paddingHorizontal: spacing.screenPadding, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white + '05', borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 44 },
  searchBarFocused: { borderColor: colors.primary + '50' },
  searchIcon: { fontSize: 14, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary },
  clearIcon: { fontSize: 14, color: colors.textMuted, padding: 4 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.screenPadding, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  seeAll: { fontSize: 11, fontWeight: '600', color: colors.primary },
  badge48h: { backgroundColor: colors.primary + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badge48hText: { fontSize: 10, fontWeight: '600', color: colors.primary },
  livePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

  arrivalsScroll: { paddingHorizontal: spacing.screenPadding, gap: 16, marginBottom: 24 },
  arrivalItem: { alignItems: 'center', width: 72 },
  storyRing: { width: 64, height: 64, borderRadius: 32, padding: 2.5, borderWidth: 2, borderColor: colors.primary, marginBottom: 6 },
  storyInner: { width: '100%', height: '100%', borderRadius: 30, overflow: 'hidden', borderWidth: 2, borderColor: colors.bg },
  storyAvatar: { width: '100%', height: '100%', borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  storyEmoji: { fontSize: 24 },
  storyBadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.bg },
  storyBadgeText: { fontSize: 10 },
  arrivalCategory: { fontSize: 10, fontWeight: '500', color: colors.textPrimary, textAlign: 'center' },
  arrivalPoster: { fontSize: 9, color: colors.textMuted, textAlign: 'center' },

  seeMoreCircle: { alignItems: 'center', width: 72 },
  seeMoreRing: { width: 64, height: 64, borderRadius: 32, padding: 2.5, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', marginBottom: 6 },
  seeMoreInner: { width: '100%', height: '100%', borderRadius: 30, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  seeMoreCount: { fontSize: 14, fontWeight: '700', color: colors.primary },
  seeMoreLabel: { fontSize: 10, fontWeight: '600', color: colors.primary },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.screenPadding, gap: 12, marginBottom: 12 },
  categoryCard: { width: CAT_CARD_W, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center', minHeight: 100, justifyContent: 'center' },
  categoryCardLive: { borderColor: colors.primary + '30' },
  liveDot: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  categoryEmoji: { fontSize: 26, marginBottom: 6 },
  categoryName: { fontSize: 10, color: colors.textPrimary, textAlign: 'center', lineHeight: 14 },
  liveNowText: { fontSize: 8, color: colors.primary, fontWeight: '600', marginTop: 4 },

  seeAllCatsBtn: { marginHorizontal: spacing.screenPadding, marginBottom: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  seeAllCatsText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  actionRowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.screenPadding, marginBottom: 10, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  actionRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  actionRowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionRowEmoji: { fontSize: 18 },
  actionRowTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  actionRowDesc: { fontSize: 10, color: colors.textMuted },
  actionRowArrow: { fontSize: 16, color: colors.textMuted },
});
