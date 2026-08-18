import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, StatusBar, Platform, Dimensions, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { EASING, colors, spacing } from '../../theme';
import CardRowSkeleton from '../../components/common/CardRowSkeleton';
import PressableScale from '../../components/common/PressableScale';
import { supabase } from '../../api/supabase';

const { width: SCREEN_W } = Dimensions.get('window');
const PRODUCT_W = (SCREEN_W - spacing.screenPadding * 2 - 12) / 2;

// There are two kinds of post now — a service you book and a product
// you order — so those are the only filters that mean anything. This
// used to list eight categories that no longer exist.
const FILTERS = [
  { key: 'all', label: 'All', type: null },
  { key: 'service', label: 'Services', type: 'service' },
  { key: 'product', label: 'Products', type: 'product' },
] as const;

// Products arrive a page at a time. The screen previously fetched every
// product on the platform in one query, with no limit at all.
const PAGE_SIZE = 24;

const CARD_COLORS = ['#16a34a', '#D946EF', '#06B6D4', '#F97316', '#EAB308', '#6366F1', '#3B82F6', '#8B5CF6'];
const colorForId = (id: string) => CARD_COLORS[Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % CARD_COLORS.length];

interface ProductRow {
  id: string;
  title: string;
  type: 'service' | 'product';
  price: number | null;
  category: string;
  imageUrl: string | null;
  sellerName: string;
  workerId: string;
  description: string | null;
}

export default function ProductCatalogueScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<typeof FILTERS[number]['key']>('all');
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const gridOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, easing: EASING.OUT, useNativeDriver: true }),
      Animated.timing(gridOpacity, { toValue: 1, duration: 300, easing: EASING.OUT, useNativeDriver: true }),
    ]).start();
  }, [gridOpacity, headerOpacity]);

  const activeType = FILTERS.find(f => f.key === activeFilter)?.type ?? null;

  const fetchPage = useCallback(async (offset: number): Promise<ProductRow[]> => {
    let query = supabase
      .from('products')
      .select('id, title, type, category, price, image_url, description, worker_id')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (activeType) query = query.eq('type', activeType);

    const { data: rows, error } = await query;
    if (error) throw error;

    const workerIds = [...new Set((rows || []).map((p: any) => p.worker_id).filter(Boolean))];
    const nameMap: Record<string, string> = {};
    if (workerIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles').select('id, full_name, business_name').in('id', workerIds);
      (profileRows || []).forEach((p: any) => { nameMap[p.id] = p.business_name || p.full_name || 'Seller'; });
    }

    return (rows || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      type: p.type === 'service' ? 'service' : 'product',
      category: p.category,
      imageUrl: p.image_url,
      sellerName: nameMap[p.worker_id] || 'Seller',
      workerId: p.worker_id,
      description: p.description,
    }));
  }, [activeType]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setReachedEnd(false);
    try {
      const rows = await fetchPage(0);
      setProducts(rows);
      setReachedEnd(rows.length < PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || reachedEnd) return;
    setLoadingMore(true);
    try {
      const rows = await fetchPage(products.length);
      setProducts(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...rows.filter(r => !seen.has(r.id))];
      });
      setReachedEnd(rows.length < PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more products:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, products.length, loading, loadingMore, reachedEnd]);

  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[st.header, { opacity: headerOpacity }]}>
        <PressableScale style={st.backBtn} onPress={() => navigation.goBack()}>
          <Text style={st.backText}>←</Text>
        </PressableScale>
        <Text style={st.headerTitle}>Products</Text>
        <View style={{ width: 36 }} />
      </Animated.View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterScroll}>
        {FILTERS.map(f => (
          <PressableScale key={f.key} style={[st.filterChip, activeFilter === f.key && st.filterChipActive]} onPress={() => setActiveFilter(f.key)}>
            <Text style={[st.filterText, activeFilter === f.key && st.filterTextActive]}>{f.label}</Text>
          </PressableScale>
        ))}
      </ScrollView>

      {loading ? (
        <CardRowSkeleton count={4} actions={false} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
          onScroll={({ nativeEvent: e }) => {
            const nearBottom =
              e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - e.layoutMeasurement.height;
            if (nearBottom) loadMore();
          }}
          scrollEventThrottle={200}
        >
          {products.length === 0 ? (
            <View style={st.emptyBox}>
              <Text style={st.emptyEmoji}>📦</Text>
              <Text style={st.emptyTitle}>
                {activeFilter === 'service' ? 'No services yet' : activeFilter === 'product' ? 'No products yet' : 'Nothing posted yet'}
              </Text>
              <Text style={st.emptySub}>Check back soon, or try a different filter.</Text>
            </View>
          ) : (
            <Animated.View style={[st.grid, { opacity: gridOpacity }]}>
              {products.map(product => {
                const accent = colorForId(product.id);
                return (
                  <PressableScale key={product.id} style={st.productCard}
                    onPress={() => navigation.navigate('ProductDetail', { product: { ...product, color: accent } })}>
                    <View style={[st.productThumb, { backgroundColor: accent + '15' }]}>
                      {product.imageUrl ? (
                        <Image source={{ uri: product.imageUrl }} style={st.productImg} />
                      ) : (
                        <Text style={st.productEmoji}>📦</Text>
                      )}
                    </View>
                    <View style={st.productInfo}>
                      <Text style={st.productTitle} numberOfLines={1}>{product.title}</Text>
                      <Text style={st.productSeller}>
                        @{product.sellerName} · {product.type === 'service' ? 'Book' : 'Order'}
                      </Text>
                      <Text style={[st.productPrice, { color: accent }]}>
                        {product.price != null ? `₦${product.price.toLocaleString()}` : 'Contact for price'}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
              {loadingMore && <ActivityIndicator color={colors.primary} style={st.moreLoader} />}
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  moreLoader: { width: '100%', marginVertical: 16 },
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  filterScroll: { paddingHorizontal: spacing.screenPadding, gap: 8, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '700' },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 12, opacity: 0.4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.screenPadding, gap: 12 },
  productCard: { width: PRODUCT_W, backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  productThumb: { height: 120, alignItems: 'center', justifyContent: 'center' },
  productImg: { width: '100%', height: '100%' },
  productEmoji: { fontSize: 36, opacity: 0.6 },
  productInfo: { padding: 12 },
  productTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  productSeller: { fontSize: 10, color: colors.textMuted, marginBottom: 6 },
  productPrice: { fontSize: 14, fontWeight: '700' },
});
