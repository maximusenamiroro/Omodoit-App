import React, { useCallback, useEffect, useRef, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import { ensureMediaPermission } from '../../lib/permissions';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Alert, Platform, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import { uploadImageToStorage, clearOldUploads } from '../../lib/uploadImage';

const getInitials = (name?: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

interface OrderItem {
  id: string;
  name: string;
  status: string;
  price: string;
  date: string;
}

interface BookingItem {
  id: string;
  worker: string;
  job: string;
  status: string;
  date: string;
  location: string;
}

export default function ClientProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'bookings' | 'saved'>('orders');

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [contentOpacity, headerOpacity]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [ordersRes, bookingsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, product_name, price, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('hire_requests')
          .select('id, job_description, location, status, created_at, worker_id')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      const orderRows = ordersRes.data || [];
      setOrders(orderRows.map((o: any) => ({
        id: o.id,
        name: o.product_name || 'Product',
        status: o.status || 'pending',
        price: o.price ? `₦${o.price.toLocaleString()}` : '',
        date: new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })));

      const bookingRows = bookingsRes.data || [];
      const workerIds = [...new Set(bookingRows.map((b: any) => b.worker_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (workerIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', workerIds);
        (profileRows || []).forEach((p: any) => { nameMap[p.id] = p.full_name || 'Worker'; });
      }
      setBookings(bookingRows.map((b: any) => ({
        id: b.id,
        worker: nameMap[b.worker_id] || 'Worker',
        job: (b.job_description || '').split('\n')[0].slice(0, 40),
        status: b.status || 'pending',
        date: new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        location: b.location || '',
      })));
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleAvatarPick = async () => {
    // Android 13+ returns an empty picker without this.
    if (!(await ensureMediaPermission('photo'))) return;

    launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 800, maxHeight: 800 }, async (res) => {
      const uri = res.assets?.[0]?.uri;
      if (!uri || !user?.id) return;

      setUploading(true);
      try {
        await clearOldUploads('avatars', user.id);
        const publicUrl = await uploadImageToStorage('avatars', uri, user.id);
        const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
        if (error) throw error;
        // AuthContext's profile will catch up via its own next fetch;
        // for immediate feedback the screen re-reads on focus already.
      } catch (err: any) {
        console.error('Avatar upload error:', err);
        Alert.alert('Upload Failed', 'Could not update your photo. Please try again.');
      } finally {
        setUploading(false);
      }
    });
  };

  const getStatusStyle = (status: string) => {
    if (status === 'accepted' || status === 'delivered' || status === 'completed') return { bg: colors.primary + '20', text: colors.primary };
    if (status === 'rejected' || status === 'cancelled' || status === 'declined') return { bg: '#EF444420', text: '#EF4444' };
    return { bg: '#F59E0B20', text: '#F59E0B' };
  };

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
            <View style={[st.avatarRing, { borderColor: colors.client }]}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={st.avatarImg} />
              ) : (
                <View style={[st.avatarFb, { backgroundColor: colors.client }]}>
                  <Text style={st.avatarFbText}>{getInitials(profile?.full_name)}</Text>
                </View>
              )}
              {uploading && (
                <View style={st.avatarUploadingOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <TouchableOpacity style={[st.avatarPlus, { backgroundColor: colors.client }]} onPress={handleAvatarPick} disabled={uploading} activeOpacity={0.85}>
              <Text style={st.avatarPlusIcon}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={st.profileName}>{profile?.full_name || 'Your Name'}</Text>
          {profile?.location && <Text style={st.profileLocation}>📍 {profile.location}</Text>}
          <Text style={st.memberText}>Member since {memberSince}</Text>

          <View style={st.statsRow}>
            {[
              { value: orders.length.toString(), label: 'Orders' },
              { value: bookings.length.toString(), label: 'Bookings' },
              { value: '0', label: 'Saved' },
            ].map((s, i) => (
              <View key={i} style={st.statItem}>
                <Text style={st.statValue}>{s.value}</Text>
                <Text style={st.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[st.editBtn, { backgroundColor: colors.client }]} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.85}>
            <Text style={st.editBtnText}>✏️ Edit Profile</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={st.tabBar}>
          {[
            { key: 'orders' as const, icon: '📦', label: 'Orders' },
            { key: 'bookings' as const, icon: '📋', label: 'Bookings' },
            { key: 'saved' as const, icon: '🔖', label: 'Saved' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[st.tab, activeTab === tab.key && st.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={st.tabIcon}>{tab.icon}</Text>
              <Text style={[st.tabText, activeTab === tab.key && st.tabTextActive]}>{tab.label}</Text>
              {activeTab === tab.key && <View style={[st.tabLine, { backgroundColor: colors.client }]} />}
            </TouchableOpacity>
          ))}
        </View>

        <Animated.View style={[st.tabContent, { opacity: contentOpacity }]}>
          {loading ? (
            <ActivityIndicator color={colors.client} style={{ marginVertical: 30 }} />
          ) : (
            <>
              {activeTab === 'orders' && (
                orders.length === 0 ? (
                  <View style={st.emptyState}>
                    <Text style={st.emptyEmoji}>📦</Text>
                    <Text style={st.emptyTitle}>No orders yet</Text>
                    <TouchableOpacity style={[st.emptyBtn, { backgroundColor: colors.client }]} onPress={() => navigation.navigate('ProductCatalogue')} activeOpacity={0.85}>
                      <Text style={st.emptyBtnText}>Browse Products</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  orders.map(order => {
                    const status = getStatusStyle(order.status);
                    return (
                      <View key={order.id} style={st.listCard}>
                        <View style={st.listCardIcon}>
                          <Text style={st.listCardEmoji}>📦</Text>
                        </View>
                        <View style={st.listCardInfo}>
                          <Text style={st.listCardTitle}>{order.name}</Text>
                          <Text style={st.listCardSub}>{order.date}</Text>
                          {!!order.price && <Text style={[st.listCardPrice, { color: colors.client }]}>{order.price}</Text>}
                        </View>
                        <View style={[st.statusBadge, { backgroundColor: status.bg }]}>
                          <Text style={[st.statusText, { color: status.text }]}>{order.status}</Text>
                        </View>
                      </View>
                    );
                  })
                )
              )}

              {activeTab === 'bookings' && (
                bookings.length === 0 ? (
                  <View style={st.emptyState}>
                    <Text style={st.emptyEmoji}>📋</Text>
                    <Text style={st.emptyTitle}>No bookings yet</Text>
                    <TouchableOpacity style={[st.emptyBtn, { backgroundColor: colors.client }]} onPress={() => navigation.navigate('Workspace')} activeOpacity={0.85}>
                      <Text style={st.emptyBtnText}>Hire a Worker</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  bookings.map(booking => {
                    const status = getStatusStyle(booking.status);
                    return (
                      <View key={booking.id} style={st.listCard}>
                        <View style={[st.listCardIcon, { backgroundColor: colors.primary + '15' }]}>
                          <Text style={st.listCardEmoji}>📋</Text>
                        </View>
                        <View style={st.listCardInfo}>
                          <Text style={st.listCardTitle}>{booking.job}</Text>
                          <Text style={st.listCardSub}>{booking.worker} · {booking.date}</Text>
                          {!!booking.location && <Text style={st.listCardLocation}>📍 {booking.location}</Text>}
                        </View>
                        <View style={[st.statusBadge, { backgroundColor: status.bg }]}>
                          <Text style={[st.statusText, { color: status.text }]}>{booking.status}</Text>
                        </View>
                      </View>
                    );
                  })
                )
              )}

              {activeTab === 'saved' && (
                <View style={st.emptyState}>
                  <Text style={st.emptyEmoji}>🔖</Text>
                  <Text style={st.emptyTitle}>No saved reels</Text>
                  <TouchableOpacity style={[st.emptyBtn, { backgroundColor: colors.client }]} onPress={() => navigation.navigate('Reels')} activeOpacity={0.85}>
                    <Text style={st.emptyBtnText}>Browse Reels</Text>
                  </TouchableOpacity>
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
  profileLocation: { fontSize: 12, color: colors.primary, marginBottom: 2 },
  memberText: { fontSize: 10, color: colors.textMuted, marginBottom: 16 },

  statsRow: { flexDirection: 'row', gap: 32, marginBottom: 18 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },

  editBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
  editBtnText: { fontSize: 12, fontWeight: '600', color: colors.white },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  tabActive: {},
  tabIcon: { fontSize: 12 },
  tabText: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  tabTextActive: { color: colors.textPrimary, fontWeight: '700' },
  tabLine: { position: 'absolute', bottom: 0, width: 32, height: 2, borderRadius: 1 },

  tabContent: { padding: spacing.screenPadding },

  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  listCardIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.flash + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  listCardEmoji: { fontSize: 20 },
  listCardInfo: { flex: 1 },
  listCardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  listCardSub: { fontSize: 10, color: colors.textMuted },
  listCardPrice: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  listCardLocation: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 40, marginBottom: 12, opacity: 0.3 },
  emptyTitle: { fontSize: 14, color: colors.textMuted, marginBottom: 16 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
  emptyBtnText: { fontSize: 12, fontWeight: '600', color: colors.white },
});
