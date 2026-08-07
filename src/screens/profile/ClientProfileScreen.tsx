import React, { useEffect, useRef, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Alert, Platform, Image, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

const MOCK_ORDERS = [
  { id: '1', name: 'Phone Screen Fix', status: 'delivered', price: '₦5,000', date: 'Jul 28' },
  { id: '2', name: 'Catering Service', status: 'pending', price: '₦45,000', date: 'Aug 5' },
];

const MOCK_BOOKINGS = [
  { id: '1', worker: 'John Adewale', job: 'Electrical Repair', status: 'accepted', date: 'Aug 2', location: 'Ikeja' },
  { id: '2', worker: 'Blessing Eze', job: 'Bridal Makeup', status: 'pending', date: 'Aug 10', location: 'Lekki' },
];

export default function ClientProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { profile, logout } = useAuth();
  const [avatarUri, setAvatarUri] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSwitch = () => {
    Alert.alert('Switch Role', 'Toggle between Client and Worker view.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch', onPress: async () => { await logout(); } },
    ]);
  };

  const getStatusStyle = (status) => {
    if (status === 'accepted' || status === 'delivered') return { bg: colors.primary + '20', text: colors.primary };
    if (status === 'rejected' || status === 'cancelled') return { bg: '#EF444420', text: '#EF4444' };
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
          <TouchableOpacity style={st.headerBarBtn} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
            <Text style={st.headerBarIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>
        <Animated.View style={[st.profileSection, { opacity: headerOpacity }]}>
          <View style={st.avatarWrap}>
            <View style={[st.avatarRing, { borderColor: colors.client }]}>
              {avatarUri || profile?.avatar_url ? (
                <Image source={{ uri: avatarUri || profile?.avatar_url }} style={st.avatarImg} />
              ) : (
                <View style={[st.avatarFb, { backgroundColor: colors.client }]}>
                  <Text style={st.avatarFbText}>{getInitials(profile?.full_name)}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={[st.avatarPlus, { backgroundColor: colors.client }]} onPress={() => {
              launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 800, maxHeight: 800 }, (res) => {
                if (res.assets && res.assets[0]?.uri) setAvatarUri(res.assets[0].uri);
              });
            }} activeOpacity={0.85}>
              <Text style={st.avatarPlusIcon}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={st.profileName}>{profile?.full_name || 'Your Name'}</Text>
          {profile?.location && <Text style={st.profileLocation}>📍 {profile.location}</Text>}
          <Text style={st.memberText}>Member since {memberSince}</Text>

          <View style={st.statsRow}>
            {[
              { value: MOCK_ORDERS.length.toString(), label: 'Orders' },
              { value: MOCK_BOOKINGS.length.toString(), label: 'Bookings' },
              { value: '0', label: 'Saved' },
            ].map((s, i) => (
              <View key={i} style={st.statItem}>
                <Text style={st.statValue}>{s.value}</Text>
                <Text style={st.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={st.profileBtns}>
            <TouchableOpacity style={[st.editBtn, { backgroundColor: colors.client }]} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.85}>
              <Text style={st.editBtnText}>✏️ Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.switchBtn} onPress={handleSwitch} activeOpacity={0.85}>
              <Text style={st.switchBtnText}>🔄</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={st.tabBar}>
          {[
            { key: 'orders', icon: '📦', label: 'Orders' },
            { key: 'bookings', icon: '📋', label: 'Bookings' },
            { key: 'saved', icon: '🔖', label: 'Saved' },
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
          {activeTab === 'orders' && (
            MOCK_ORDERS.length === 0 ? (
              <View style={st.emptyState}>
                <Text style={st.emptyEmoji}>📦</Text>
                <Text style={st.emptyTitle}>No orders yet</Text>
                <TouchableOpacity style={[st.emptyBtn, { backgroundColor: colors.client }]} activeOpacity={0.85}>
                  <Text style={st.emptyBtnText}>Browse Products</Text>
                </TouchableOpacity>
              </View>
            ) : (
              MOCK_ORDERS.map(order => {
                const status = getStatusStyle(order.status);
                return (
                  <TouchableOpacity key={order.id} style={st.listCard} activeOpacity={0.85}>
                    <View style={st.listCardIcon}>
                      <Text style={st.listCardEmoji}>📦</Text>
                    </View>
                    <View style={st.listCardInfo}>
                      <Text style={st.listCardTitle}>{order.name}</Text>
                      <Text style={st.listCardSub}>{order.date}</Text>
                      <Text style={[st.listCardPrice, { color: colors.client }]}>{order.price}</Text>
                    </View>
                    <View style={[st.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[st.statusText, { color: status.text }]}>{order.status}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )
          )}

          {activeTab === 'bookings' && (
            MOCK_BOOKINGS.length === 0 ? (
              <View style={st.emptyState}>
                <Text style={st.emptyEmoji}>📋</Text>
                <Text style={st.emptyTitle}>No bookings yet</Text>
                <TouchableOpacity style={[st.emptyBtn, { backgroundColor: colors.client }]} activeOpacity={0.85}>
                  <Text style={st.emptyBtnText}>Hire a Worker</Text>
                </TouchableOpacity>
              </View>
            ) : (
              MOCK_BOOKINGS.map(booking => {
                const status = getStatusStyle(booking.status);
                return (
                  <TouchableOpacity key={booking.id} style={st.listCard} activeOpacity={0.85}>
                    <View style={[st.listCardIcon, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={st.listCardEmoji}>📋</Text>
                    </View>
                    <View style={st.listCardInfo}>
                      <Text style={st.listCardTitle}>{booking.job}</Text>
                      <Text style={st.listCardSub}>{booking.worker} · {booking.date}</Text>
                      <Text style={st.listCardLocation}>📍 {booking.location}</Text>
                    </View>
                    <View style={[st.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[st.statusText, { color: status.text }]}>{booking.status}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )
          )}

          {activeTab === 'saved' && (
            <View style={st.emptyState}>
              <Text style={st.emptyEmoji}>🔖</Text>
              <Text style={st.emptyTitle}>No saved reels</Text>
              <TouchableOpacity style={[st.emptyBtn, { backgroundColor: colors.client }]} activeOpacity={0.85}>
                <Text style={st.emptyBtnText}>Browse Reels</Text>
              </TouchableOpacity>
            </View>
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
  avatarPlus: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  avatarPlusIcon: { fontSize: 16, fontWeight: '700', color: colors.white },

  profileName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  profileLocation: { fontSize: 12, color: colors.primary, marginBottom: 2 },
  memberText: { fontSize: 10, color: colors.textMuted, marginBottom: 16 },

  statsRow: { flexDirection: 'row', gap: 32, marginBottom: 18 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },

  profileBtns: { flexDirection: 'row', gap: 10 },
  editBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
  editBtnText: { fontSize: 12, fontWeight: '600', color: colors.white },
  switchBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  switchBtnText: { fontSize: 16 },

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
