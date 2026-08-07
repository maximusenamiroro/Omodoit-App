import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Platform, Dimensions, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const PRODUCT_W = (SCREEN_W - spacing.screenPadding * 2 - 12) / 2;

const MOCK_PRODUCTS = [
  { id: '1', title: 'AC Servicing', price: '₦12,000', seller: 'John A.', category: 'Service', color: '#16a34a' },
  { id: '2', title: 'Hair Braiding', price: '₦5,000', seller: 'Blessing E.', category: 'Beauty', color: '#D946EF' },
  { id: '3', title: 'Phone Screen Fix', price: '₦8,000', seller: 'Tunde B.', category: 'Tech', color: '#06B6D4' },
  { id: '4', title: 'Jollof Rice Tray', price: '₦3,500', seller: 'Chidinma O.', category: 'Food', color: '#F97316' },
  { id: '5', title: 'Generator Repair', price: '₦15,000', seller: 'Emeka N.', category: 'Handwork', color: '#16a34a' },
  { id: '6', title: 'Wedding Makeup', price: '₦25,000', seller: 'Grace U.', category: 'Beauty', color: '#D946EF' },
  { id: '7', title: 'House Painting', price: '₦45,000', seller: 'David O.', category: 'Handwork', color: '#EAB308' },
  { id: '8', title: 'Laptop Repair', price: '₦10,000', seller: 'Musa I.', category: 'Tech', color: '#6366F1' },
];

const FILTERS = ['All', 'Service', 'Beauty', 'Tech', 'Food', 'Handwork'];

export default function ProductCatalogueScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('All');

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const gridOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(gridOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const filtered = activeFilter === 'All' ? MOCK_PRODUCTS : MOCK_PRODUCTS.filter(p => p.category === activeFilter);

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

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterScroll}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[st.filterChip, activeFilter === f && st.filterChipActive]} onPress={() => setActiveFilter(f)} activeOpacity={0.85}>
            <Text style={[st.filterText, activeFilter === f && st.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>
        <Animated.View style={[st.grid, { opacity: gridOpacity }]}>
          {filtered.map(product => (
            <TouchableOpacity key={product.id} style={st.productCard}
              onPress={() => navigation.navigate('ProductDetail', { product })} activeOpacity={0.85}>
              <View style={[st.productThumb, { backgroundColor: product.color + '15' }]}>
                <Text style={st.productEmoji}>📦</Text>
              </View>
              <View style={st.productInfo}>
                <Text style={st.productTitle} numberOfLines={1}>{product.title}</Text>
                <Text style={st.productSeller}>@{product.seller}</Text>
                <Text style={[st.productPrice, { color: product.color }]}>{product.price}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>
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

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.screenPadding, gap: 12 },
  productCard: { width: PRODUCT_W, backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  productThumb: { height: 120, alignItems: 'center', justifyContent: 'center' },
  productEmoji: { fontSize: 36, opacity: 0.6 },
  productInfo: { padding: 12 },
  productTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  productSeller: { fontSize: 10, color: colors.textMuted, marginBottom: 6 },
  productPrice: { fontSize: 14, fontWeight: '700' },
});
