import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Platform, Dimensions, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { supabase } from '../../api/supabase';

const { width: SCREEN_W } = Dimensions.get('window');
const PRODUCT_W = (SCREEN_W - spacing.screenPadding * 2 - 12) / 2;

// Matches AddProductScreen's category list exactly, so filtering here
// always lines up with what a worker could have actually chosen when
// publishing — previously this used a different, mismatched list
// ('Service', 'Beauty', 'Tech', 'Food', 'Handwork') that didn't match
// any category a product could actually be saved under.
const FILTERS = ['All', 'Service', 'Physical Product', 'Digital Product', 'Consultation', 'Repair', 'Installation', 'Training', 'Other'];

const CARD_COLORS = ['#16a34a', '#D946EF', '#06B6D4', '#F97316', '#EAB308', '#6366F1', '#3B82F6', '#8B5CF6'];
const colorForId = (id: string) => CARD_COLORS[Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % CARD_COLORS.length];

interface ProductRow {
  id: string;
  title: string;
  price: number | null;
  category: string;
  imageUrl: string | null;
  sellerName: string;
  workerId: string;
  description: string | null;
}

export default function ProductCatalogueScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('All');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const gridOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(gridOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('id, title, category, price, image_url, description, worker_id')
        .order('created_at', { ascending: false });

      if (activeFilter !== 'All') {
        query = query.eq('category', activeFilter);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      const workerIds = [...new Set((rows || []).map((p: any) => p.worker_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (workerIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name, business_name').in('id', workerIds);
        (profileRows || []).forEach((p: any) => { nameMap[p.id] = p.business_name || p.full_name || 'Seller'; });
      }

      setProducts((rows || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        category: p.category,
        imageUrl: p.image_url,
        sellerName: nameMap[p.worker_id] || 'Seller',
        workerId: p.worker_id,
        description: p.description,
      })));
    } catch (err) {
      console.error('Failed to load products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[st.header, { opacity: headerOpacity }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={st.backText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Products</Text>
        <View style={{ width: 36 }} />
      </Animated.View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterScroll}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[st.filterChip, activeFilter === f && st.filterChipActive]} onPress={() => setActiveFilter(f)} activeOpacity={0.85}>
            <Text style={[st.filterText, activeFilter === f && st.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={st.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>
          {products.length === 0 ? (
            <View style={st.emptyBox}>
              <Text style={st.emptyEmoji}>📦</Text>
              <Text style={st.emptyTitle}>No products yet</Text>
              <Text style={st.emptySub}>Check back soon, or try a different filter.</Text>
            </View>
          ) : (
            <Animated.View style={[st.grid, { opacity: gridOpacity }]}>
              {products.map(product => {
                const accent = colorForId(product.id);
                return (
                  <TouchableOpacity key={product.id} style={st.productCard}
                    onPress={() => navigation.navigate('ProductDetail', { product: { ...product, color: accent } })} activeOpacity={0.85}>
                    <View style={[st.productThumb, { backgroundColor: accent + '15' }]}>
                      {product.imageUrl ? (
                        <Image source={{ uri: product.imageUrl }} style={st.productImg} />
                      ) : (
                        <Text style={st.productEmoji}>📦</Text>
                      )}
                    </View>
                    <View style={st.productInfo}>
                      <Text style={st.productTitle} numberOfLines={1}>{product.title}</Text>
                      <Text style={st.productSeller}>@{product.sellerName}</Text>
                      <Text style={[st.productPrice, { color: accent }]}>
                        {product.price != null ? `₦${product.price.toLocaleString()}` : 'Contact for price'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}
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
