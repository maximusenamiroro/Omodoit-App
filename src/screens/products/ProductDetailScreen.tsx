import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Animated, StatusBar, Platform, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import { colors, spacing } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';

export default function ProductDetailScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { product } = route.params;
  const [ordering, setOrdering] = useState(false);
  const [muted, setMuted] = useState(true);

  // A service is booked, a product is ordered — two different tables and
  // two different words on the button. Rows created before products.type
  // existed have no type at all, and every one of those is a product.
  const isService = product.type === 'service';

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
  }, [contentOpacity, contentSlide, headerOpacity]);

  // Booking reuses HireWorkerScreen rather than inserting a hire_request
  // here: that screen already collects location, date and budget, sends
  // the notification, and is what the worker's Workstation expects.
  const handleBook = async () => {
    if (!user?.id) {
      Alert.alert('Please Log In', 'You need to be logged in to book a service.');
      return;
    }

    let rating = 0;
    let reviewCount = 0;
    try {
      const { data: reviewRows } = await supabase.from('reviews').select('rating').eq('worker_id', product.workerId);
      const ratings = (reviewRows || []).map((r: any) => r.rating);
      reviewCount = ratings.length;
      rating = reviewCount > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / reviewCount : 0;
    } catch {
      // Non-fatal: the booking form only shows these, it doesn't need them.
    }

    navigation.navigate('HireWorker', {
      worker: {
        id: product.workerId,
        name: product.sellerName || 'Worker',
        rating: Number(rating.toFixed(1)),
        reviews: reviewCount,
      },
      subcategoryName: product.title,
    });
  };

  const handleOrder = async () => {
    if (!user?.id) {
      Alert.alert('Please Log In', 'You need to be logged in to place an order.');
      return;
    }
    if (ordering) return;

    setOrdering(true);
    try {
      const { error } = await supabase.from('orders').insert({
        user_id: user.id,
        product_id: product.id,
        product_name: product.title,
        product_image_url: product.imageUrl || null,
        price: product.price,
        quantity: 1,
        total_amount: product.price || null,
        status: 'pending',
      });

      if (error) throw error;

      Alert.alert('Order Placed!', 'Your order for ' + product.title + ' has been sent to ' + product.sellerName + '. They will confirm shortly.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      console.error('Order submission error:', err);
      Alert.alert('Could Not Place Order', 'Something went wrong. Please check your connection and try again.');
    } finally {
      setOrdering(false);
    }
  };

  const goToChat = () => {
    navigation.navigate('Chat', { otherUserId: product.workerId, otherUserName: product.sellerName, otherUserAvatar: null });
  };

  const viewSellerProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, location, experience, verification_status, category, subcategory')
        .eq('id', product.workerId)
        .maybeSingle();

      if (error || !data) {
        Alert.alert('Could Not Load Profile', 'Please try again.');
        return;
      }

      const { data: reviewRows } = await supabase.from('reviews').select('rating').eq('worker_id', product.workerId);
      const ratings = (reviewRows || []).map((r: any) => r.rating);
      const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;

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
        color: product.color || colors.primary,
        subcategoryName: data.subcategory || data.category,
      });
    } catch (err) {
      console.error('Failed to load seller profile:', err);
      Alert.alert('Could Not Load Profile', 'Please try again.');
    }
  };

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[st.header, { opacity: headerOpacity }]}>
        <PressableScale style={st.backBtn} onPress={() => navigation.goBack()}>
          <Text style={st.backText}>←</Text>
        </PressableScale>
        <Text style={st.headerTitle}>{isService ? 'Service Details' : 'Product Details'}</Text>
        <PressableScale style={st.shareBtn}>
          <Text style={st.shareIcon}>↗️</Text>
        </PressableScale>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}>
        {/* Product image */}
        <View style={[st.imageContainer, { backgroundColor: (product.color || colors.primary) + '15' }]}>
          {product.videoUrl ? (
            <PressableScale onPress={() => setMuted(m => !m)} style={st.heroImage}>
              <Video
                source={{ uri: product.videoUrl, type: 'mp4' }}
                style={st.heroImage}
                resizeMode="cover"
                repeat
                muted={muted}
                poster={product.imageUrl || undefined}
                useTextureView={Platform.OS === 'android'}
                onError={(e: any) => console.log('Product video error:', JSON.stringify(e))}
              />
              <View style={st.muteBadge}>
                <Text style={st.muteBadgeText}>{muted ? '🔇 Tap for sound' : '🔊'}</Text>
              </View>
            </PressableScale>
          ) : product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={st.heroImage} />
          ) : (
            <Text style={st.imageEmoji}>{isService ? '🛠️' : '📦'}</Text>
          )}
        </View>

        <Animated.View style={[st.content, { opacity: contentOpacity, transform: [{ translateY: contentSlide }] }]}>
          <Text style={st.title}>{product.title}</Text>
          <Text style={[st.price, { color: product.color || colors.primary }]}>
            {product.price != null ? `₦${Number(product.price).toLocaleString()}` : 'Contact for price'}
          </Text>

          <View style={st.sellerRow}>
            <View style={[st.sellerAvatar, { backgroundColor: product.color || colors.primary }]}>
              <Text style={st.sellerAvatarText}>{(product.sellerName || 'W')[0]}</Text>
            </View>
            <View>
              <Text style={st.sellerName}>@{product.sellerName}</Text>
              <Text style={st.sellerLabel}>{isService ? 'Service provider' : 'Seller'}</Text>
            </View>
            <PressableScale style={st.viewProfileBtn} onPress={viewSellerProfile}>
              <Text style={st.viewProfileText}>View Profile</Text>
            </PressableScale>
          </View>

          <View style={st.section}>
            <Text style={st.sectionTitle}>Description</Text>
            <View style={st.sectionCard}>
              <Text style={st.descText}>{product.description || `No description provided for ${product.title}. Contact the seller for details.`}</Text>
            </View>
          </View>

          <View style={st.section}>
            <Text style={st.sectionTitle}>Details</Text>
            <View style={st.sectionCard}>
              {[
                { label: 'Type', value: isService ? 'Service' : 'Product' },
                { label: 'Delivery', value: isService ? 'On-site service' : 'Arranged with seller' },
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
        <PressableScale style={st.msgBtn} onPress={goToChat}>
          <Text style={st.msgIcon}>💬</Text>
        </PressableScale>
        <PressableScale
          style={[st.orderBtn, { backgroundColor: product.color || colors.primary }, ordering && { opacity: 0.6 }]}
          onPress={isService ? handleBook : handleOrder}
          disabled={ordering}
        >
          <Text style={st.orderBtnText}>
            {isService ? '📅 Book Now' : ordering ? 'Placing Order…' : '🛒 Order Now'}
          </Text>
        </PressableScale>
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
  heroImage: { width: '100%', height: '100%' },
  imageEmoji: { fontSize: 64, opacity: 0.5 },
  muteBadge: { position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#00000080' },
  muteBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },

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
