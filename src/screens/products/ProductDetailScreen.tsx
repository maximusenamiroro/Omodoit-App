import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

export default function ProductDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { product } = route.params;

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleOrder = () => {
    Alert.alert('Order Placed!', 'Your order for ' + product.title + ' has been sent to ' + product.seller + '. They will confirm shortly.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]);
  };

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[st.header, { opacity: headerOpacity }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={st.backText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Product Details</Text>
        <TouchableOpacity style={st.shareBtn} activeOpacity={0.7}>
          <Text style={st.shareIcon}>↗️</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}>
        {/* Product image */}
        <View style={[st.imageContainer, { backgroundColor: (product.color || colors.primary) + '15' }]}>
          <Text style={st.imageEmoji}>📦</Text>
        </View>

        <Animated.View style={[st.content, { opacity: contentOpacity, transform: [{ translateY: contentSlide }] }]}>
          <Text style={st.title}>{product.title}</Text>
          <Text style={[st.price, { color: product.color || colors.primary }]}>{product.price}</Text>

          <View style={st.sellerRow}>
            <View style={[st.sellerAvatar, { backgroundColor: product.color || colors.primary }]}>
              <Text style={st.sellerAvatarText}>{(product.seller || 'W')[0]}</Text>
            </View>
            <View>
              <Text style={st.sellerName}>@{product.seller}</Text>
              <Text style={st.sellerLabel}>Seller</Text>
            </View>
            <TouchableOpacity style={st.viewProfileBtn} activeOpacity={0.85}>
              <Text style={st.viewProfileText}>View Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={st.section}>
            <Text style={st.sectionTitle}>Description</Text>
            <View style={st.sectionCard}>
              <Text style={st.descText}>Professional {product.title?.toLowerCase()} service. Quality work guaranteed. Price may vary based on the scope of work. Contact the seller for a custom quote.</Text>
            </View>
          </View>

          <View style={st.section}>
            <Text style={st.sectionTitle}>Details</Text>
            <View style={st.sectionCard}>
              {[
                { label: 'Category', value: product.category || 'General' },
                { label: 'Delivery', value: 'On-site service' },
                { label: 'Availability', value: 'Available now' },
                { label: 'Commission', value: '0% - full payment to worker' },
              ].map((item, i) => (
                <View key={i} style={[st.detailRow, i < 3 && st.detailRowBorder]}>
                  <Text style={st.detailLabel}>{item.label}</Text>
                  <Text style={st.detailValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[st.bottomBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16 }]}>
        <TouchableOpacity style={st.msgBtn} activeOpacity={0.85}>
          <Text style={st.msgIcon}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.orderBtn, { backgroundColor: product.color || colors.primary }]} onPress={handleOrder} activeOpacity={0.85}>
          <Text style={st.orderBtnText}>🛒 Order Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  shareBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  shareIcon: { fontSize: 16 },

  imageContainer: { height: 240, alignItems: 'center', justifyContent: 'center' },
  imageEmoji: { fontSize: 64, opacity: 0.5 },

  content: { padding: spacing.screenPadding },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  price: { fontSize: 24, fontWeight: '700', marginBottom: 16 },

  sellerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 20 },
  sellerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sellerAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sellerName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  sellerLabel: { fontSize: 10, color: colors.textMuted },
  viewProfileBtn: { marginLeft: 'auto', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.white + '08', borderWidth: 1, borderColor: colors.border },
  viewProfileText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },

  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  sectionCard: { backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  descText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  detailRowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  detailLabel: { fontSize: 12, color: colors.textMuted },
  detailValue: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },

  bottomBar: { flexDirection: 'row', paddingHorizontal: spacing.screenPadding, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, gap: 10 },
  msgBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  msgIcon: { fontSize: 20 },
  orderBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  orderBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
