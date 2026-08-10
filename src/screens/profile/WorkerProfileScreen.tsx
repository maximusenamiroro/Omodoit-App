import React, { useCallback, useEffect, useRef, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Alert, Platform, Image, Dimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import { uploadImageToStorage, clearOldUploads } from '../../lib/uploadImage';

const { width: SCREEN_W } = Dimensions.get('window');
const REEL_W = (SCREEN_W - spacing.screenPadding * 2 - 8) / 3;

const getInitials = (name?: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

interface ReelItem { id: string; likes: number; }
interface ProductItem { id: string; title: string; price: number | null; category: string; }
interface ReviewItem { id: string; name: string; rating: number; text: string; date: string; }

export default function WorkerProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'reels' | 'products' | 'reviews'>('reels');

  const [reels, setReels] = useState<ReelItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [reelsRes, productsRes, reviewsRes] = await Promise.all([
        supabase.from('reels').select('id, likes').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('products').select('id, title, price, category').eq('worker_id', user.id).order('created_at', { ascending: false }),
        supabase.from('reviews').select('id, rating, comment, created_at, client_id').eq('worker_id', user.id).order('created_at', { ascending: false }).limit(20),
      ]);

      // Isolated from the Promise.all above — 'follows' hasn't been
      // confirmed to exist anywhere in this codebase (unlike reels/
      // products/reviews, which are all in real use elsewhere). If
      // this guess is wrong, it should only cost the follower count,
      // not take down the rest of the profile with it.
      try {
        const { count } = await supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', user.id);
        setFollowerCount(count || 0);
      } catch (followErr) {
        console.warn('Could not load follower count (non-fatal):', followErr);
        setFollowerCount(0);
      }

      setReels((reelsRes.data || []).map((r: any) => ({ id: r.id, likes: r.likes || 0 })));
      setProducts((productsRes.data || []).map((p: any) => ({ id: p.id, title: p.title, price: p.price, category: p.category })));

      const reviewRows = reviewsRes.data || [];
      const clientIds = [...new Set(reviewRows.map((r: any) => r.client_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', clientIds);
        (profileRows || []).forEach((p: any) => { nameMap[p.id] = p.full_name || 'A client'; });
      }
      setReviews(reviewRows.map((r: any) => ({
        id: r.id,
        name: nameMap[r.client_id] || 'A client',
        rating: r.rating || 0,
        text: r.comment || '',
        date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })));
    } catch (err) {
      console.error('Failed to load worker profile data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleAvatarPick = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 800, maxHeight: 800 }, async (res) => {
      const uri = res.assets?.[0]?.uri;
      if (!uri || !user?.id) return;

      setUploading(true);
      try {
        await clearOldUploads('avatars', user.id);
        const publicUrl = await uploadImageToStorage('avatars', uri, user.id);
        const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
        if (error) throw error;
      } catch (err) {
        console.error('Avatar upload error:', err);
        Alert.alert('Upload Failed', 'Could not update your photo. Please try again.');
      } finally {
        setUploading(false);
      }
    });
  };

  const totalLikes = reels.reduce((s, r) => s + r.likes, 0);
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Today';

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[st.headerBar, { opacity: headerOpacity }]}>
        <View style={{ width: 32 }} />
        <Text style={st.headerBarTitle}>My Profile</Text>
        <View style={st.headerBarRight}>
          <TouchableOpacity style={st.headerBarBtn} onPress={() => Alert.alert('Bank Details', 'This feature is coming soon.')} activeOpacity={0.7}>
            <Text style={st.headerBarIcon}>🏦</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.headerBarBtn} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
            <Text style={st.headerBarIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>
        <Animated.View style={[st.profileSection, { opacity: headerOpacity }]}>
          <View style={st.avatarWrap}>
            <View style={[st.avatarRing, { borderColor: colors.primary }]}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={st.avatarImg} />
              ) : (
                <View style={[st.avatarFb, { backgroundColor: colors.primary }]}>
                  <Text style={st.avatarFbText}>{getInitials(profile?.full_name)}</Text>
                </View>
              )}
              {uploading && (
                <View style={st.avatarUploadingOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <TouchableOpacity style={[st.avatarPlus, { backgroundColor: colors.primary }]} onPress={handleAvatarPick} disabled={uploading} activeOpacity={0.85}>
              <Text style={st.avatarPlusIcon}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={st.profileName}>{profile?.full_name || 'Your Name'}</Text>
          {profile?.location && <Text style={[st.profileLocation, { color: colors.primary }]}>📍 {profile.location}</Text>}
          <Text style={st.memberText}>Member since {memberSince}</Text>

          <View style={st.ratingRow}>
            <Text style={st.ratingStar}>⭐</Text>
            <Text style={st.ratingValue}>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</Text>
            <Text style={st.ratingCount}>({reviews.length} review{reviews.length === 1 ? '' : 's'})</Text>
          </View>

          <View style={st.statsRow}>
            {[
              { value: reels.length.toString(), label: 'Reels' },
              { value: followerCount.toString(), label: 'Followers' },
              { value: totalLikes.toString(), label: 'Likes' },
            ].map((s, i) => (
              <View key={i} style={st.statItem}>
                <Text style={st.statValue}>{s.value}</Text>
                <Text style={st.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[st.editBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.85}>
            <Text style={st.editBtnText}>✏️ Edit Profile</Text>
          </TouchableOpacity>

          <View style={st.commBanner}>
            <Text style={st.commIcon}>💰</Text>
            <Text style={st.commText}>0% commission — you keep everything you earn</Text>
          </View>
        </Animated.View>

        <View style={st.tabBar}>
          {[
            { key: 'reels' as const, icon: '🎬', label: 'Reels' },
            { key: 'products' as const, icon: '📦', label: 'Products' },
            { key: 'reviews' as const, icon: '⭐', label: 'Reviews' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[st.tab, activeTab === tab.key && st.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={st.tabIcon}>{tab.icon}</Text>
              <Text style={[st.tabText, activeTab === tab.key && st.tabTextActive]}>{tab.label}</Text>
              {activeTab === tab.key && <View style={[st.tabLine, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          ))}
        </View>

        <Animated.View style={{ opacity: contentOpacity }}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
          ) : (
            <>
              {activeTab === 'reels' && (
                <View style={st.reelsGrid}>
                  {reels.map(reel => (
                    <TouchableOpacity key={reel.id} style={st.reelCard} activeOpacity={0.85}>
                      <View style={st.reelThumb}>
                        <Text style={st.reelPlayIcon}>▶</Text>
                      </View>
                      <View style={st.reelOverlay}>
                        <View style={st.reelStat}>
                          <Text style={st.reelStatIcon}>❤</Text>
                          <Text style={st.reelStatText}>{reel.likes}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={st.addReelCard} onPress={() => navigation.navigate('CreateReel')} activeOpacity={0.85}>
                    <Text style={st.addReelIcon}>+</Text>
                    <Text style={st.addReelText}>New Reel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeTab === 'products' && (
                <View style={st.productsSection}>
                  {products.length === 0 && (
                    <Text style={st.emptyText}>No products yet</Text>
                  )}
                  {products.map(product => (
                    <TouchableOpacity key={product.id} style={st.productCard} activeOpacity={0.85}>
                      <View style={st.productThumb}>
                        <Text style={st.productEmoji}>📦</Text>
                      </View>
                      <View style={st.productInfo}>
                        <Text style={st.productTitle}>{product.title}</Text>
                        <Text style={st.productCat}>{product.category}</Text>
                        <Text style={[st.productPrice, { color: colors.primary }]}>
                          {product.price != null ? `₦${product.price.toLocaleString()}` : 'Contact for price'}
                        </Text>
                      </View>
                      <Text style={st.productArrow}>→</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={st.addProductBtn} onPress={() => navigation.navigate('AddProduct')} activeOpacity={0.85}>
                    <Text style={[st.addProductText, { color: colors.primary }]}>+ Add Product</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeTab === 'reviews' && (
                <View style={st.reviewsSection}>
                  {reviews.length === 0 && (
                    <Text style={st.emptyText}>No reviews yet</Text>
                  )}
                  {reviews.map(review => (
                    <View key={review.id} style={st.reviewCard}>
                      <View style={st.reviewTop}>
                        <View style={st.reviewAvatar}>
                          <Text style={st.reviewAvatarText}>{review.name[0]}</Text>
                        </View>
                        <View style={st.reviewInfo}>
                          <Text style={st.reviewName}>{review.name}</Text>
                          <Text style={st.reviewDate}>{review.date}</Text>
                        </View>
                        <View style={st.reviewStars}>
                          {Array.from({ length: review.rating }, (_, i) => (
                            <Text key={i} style={st.reviewStar}>⭐</Text>
                          ))}
                        </View>
                      </View>
                      {!!review.text && <Text style={st.reviewText}>{review.text}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBarTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  headerBarRight: { flexDirection: 'row', gap: 8 },
  headerBarBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  headerBarIcon: { fontSize: 16 },

  profileSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: spacing.screenPadding },
  avatarWrap: { marginBottom: 14 },
  avatarRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarFb: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarFbText: { fontSize: 32, fontWeight: '700', color: colors.white },
  avatarUploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderRadius: 44 },
  avatarPlus: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  avatarPlusIcon: { fontSize: 16, fontWeight: '700', color: colors.white },

  profileName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  profileLocation: { fontSize: 12, marginBottom: 2 },
  memberText: { fontSize: 10, color: colors.textMuted, marginBottom: 10 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  ratingStar: { fontSize: 14 },
  ratingValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  ratingCount: { fontSize: 12, color: colors.textMuted },

  statsRow: { flexDirection: 'row', gap: 32, marginBottom: 18 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },

  editBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, marginBottom: 14 },
  editBtnText: { fontSize: 12, fontWeight: '600', color: colors.white },

  commBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '10', borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '25', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  commIcon: { fontSize: 18 },
  commText: { fontSize: 11, color: colors.primary, fontWeight: '500', flex: 1 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  tabActive: {},
  tabIcon: { fontSize: 12 },
  tabText: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  tabTextActive: { color: colors.textPrimary, fontWeight: '700' },
  tabLine: { position: 'absolute', bottom: 0, width: 32, height: 2, borderRadius: 1 },

  emptyText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingVertical: 30 },

  reelsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.screenPadding, gap: 4 },
  reelCard: { width: REEL_W, aspectRatio: 9 / 16, backgroundColor: colors.bgCard, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  reelThumb: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  reelPlayIcon: { fontSize: 20, color: colors.white, opacity: 0.5 },
  reelOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.6)' },
  reelStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reelStatIcon: { fontSize: 10, color: colors.white },
  reelStatText: { fontSize: 10, color: colors.white, fontWeight: '600' },
  addReelCard: { width: REEL_W, aspectRatio: 9 / 16, backgroundColor: colors.bgCard, borderRadius: 8, borderWidth: 1.5, borderColor: colors.primary + '30', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addReelIcon: { fontSize: 24, color: colors.primary, marginBottom: 4 },
  addReelText: { fontSize: 10, color: colors.primary, fontWeight: '600' },

  productsSection: { padding: spacing.screenPadding },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  productThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary + '10', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  productEmoji: { fontSize: 20 },
  productInfo: { flex: 1 },
  productTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  productCat: { fontSize: 10, color: colors.textMuted },
  productPrice: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  productArrow: { fontSize: 14, color: colors.textMuted },
  addProductBtn: { paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary + '30', borderStyle: 'dashed', alignItems: 'center' },
  addProductText: { fontSize: 13, fontWeight: '600' },

  reviewsSection: { padding: spacing.screenPadding },
  reviewCard: { backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  reviewAvatarText: { fontSize: 12, fontWeight: '700', color: colors.white },
  reviewInfo: { flex: 1 },
  reviewName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  reviewDate: { fontSize: 10, color: colors.textMuted },
  reviewStars: { flexDirection: 'row' },
  reviewStar: { fontSize: 10 },
  reviewText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
