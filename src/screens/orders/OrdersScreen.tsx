import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Animated, StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

type TabKey = 'all' | 'active' | 'completed' | 'cancelled';

interface OrderRow {
  id: string;
  otherPartyId: string;
  otherPartyName: string;
  service: string;
  status: string;
  date: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#F59E0B', bg: '#F59E0B15' },
  accepted: { label: 'Accepted', color: '#3B82F6', bg: '#3B82F615' },
  in_progress: { label: 'In Progress', color: '#16a34a', bg: '#16a34a15' },
  completed: { label: 'Completed', color: '#06B6D4', bg: '#06B6D415' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bg: '#EF444415' },
  declined: { label: 'Declined', color: '#EF4444', bg: '#EF444415' },
  expired: { label: 'Taken by Another Worker', color: '#9CA3AF', bg: '#9CA3AF15' },
};

const ACTIVE_STATUSES = ['pending', 'accepted', 'in_progress'];

export default function OrdersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const accentColor = role === 'client' ? colors.client : colors.primary;

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(listOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadOrders = useCallback(async () => {
    if (!user?.id || !role) return;
    setLoading(true);
    try {
      const column = role === 'client' ? 'client_id' : 'worker_id';
      let query = supabase
        .from('hire_requests')
        .select('id, client_id, worker_id, job_description, location, status, created_at')
        .eq(column, user.id)
        .order('created_at', { ascending: false });

      // A single Flash Job creates one request per matching worker, so
      // a client would otherwise see a pile of near-duplicate 'expired'
      // entries once someone else accepts. A worker only ever has
      // their own single row, where 'expired' is meaningful (someone
      // else responded first) rather than noise, so only hide it here
      // for the client view.
      if (role === 'client') {
        query = query.neq('status', 'expired');
      }

      const { data: rows, error } = await query;

      if (error) throw error;

      const otherIdColumn = role === 'client' ? 'worker_id' : 'client_id';
      const otherIds = [...new Set((rows || []).map((r: any) => r[otherIdColumn]).filter(Boolean))];

      let nameMap: Record<string, string> = {};
      if (otherIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, full_name, business_name')
          .in('id', otherIds);
        (profileRows || []).forEach((p: any) => {
          nameMap[p.id] = p.full_name || p.business_name || 'User';
        });
      }

      const mapped: OrderRow[] = (rows || []).map((r: any) => ({
        id: r.id,
        otherPartyId: r[otherIdColumn],
        otherPartyName: nameMap[r[otherIdColumn]] || 'User',
        service: (r.job_description || '').split('\n')[0].slice(0, 60),
        status: r.status || 'pending',
        date: r.created_at,
      }));

      setOrders(mapped);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, role]);

  // Reload every time this screen comes into focus (e.g. returning
  // from HireWorker after submitting a new booking), plus a live
  // realtime subscription so status changes from the other party
  // (worker accepting, etc.) appear instantly without needing to
  // leave and re-enter the screen.
  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  useEffect(() => {
    if (!user?.id || !role) return;
    const column = role === 'client' ? 'client_id' : 'worker_id';
    const channel = supabase
      .channel('orders_' + user.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'hire_requests', filter: `${column}=eq.${user.id}`,
      }, () => loadOrders())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, role, loadOrders]);

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ACTIVE_STATUSES.includes(order.status);
    if (activeTab === 'completed') return order.status === 'completed';
    if (activeTab === 'cancelled') return order.status === 'cancelled' || order.status === 'declined' || order.status === 'expired';
    return true;
  });

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'active', label: 'Active', count: orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length },
    { key: 'completed', label: 'Done', count: orders.filter(o => o.status === 'completed').length },
    { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled' || o.status === 'declined' || o.status === 'expired').length },
  ];

  const renderOrder = ({ item }: { item: OrderRow }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const orderDate = new Date(item.date);
    const dateStr = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = orderDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderTop}>
          <View style={[styles.orderAvatar, { backgroundColor: accentColor }]}>
            <Text style={styles.orderAvatarText}>{getInitials(item.otherPartyName)}</Text>
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.orderWorker}>{item.otherPartyName}</Text>
            <Text style={styles.orderService} numberOfLines={1}>{item.service}</Text>
            <View style={styles.orderDateRow}>
              <Text style={styles.orderDate}>📅 {dateStr} at {timeStr}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.color + '30' }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {(item.status === 'accepted' || item.status === 'in_progress') && role === 'client' && (
          <TouchableOpacity
            style={[styles.trackBtn, { backgroundColor: accentColor }]}
            onPress={() => navigation.navigate('Tracking', { bookingId: item.id, workerId: item.otherPartyId, workerName: item.otherPartyName, service: item.service })}
            activeOpacity={0.85}
          >
            <Text style={styles.trackBtnText}>📍 Track Worker</Text>
          </TouchableOpacity>
        )}
        {item.status === 'completed' && role === 'client' && (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => navigation.navigate('LeaveReview', { workerId: item.otherPartyId, workerName: item.otherPartyName })}
            activeOpacity={0.85}
          >
            <Text style={styles.reviewBtnText}>⭐ Leave Review</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orders & Bookings</Text>
        <View style={{ width: 36 }} />
      </Animated.View>

      <Animated.View style={[styles.tabRow, { opacity: headerOpacity }]}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { backgroundColor: accentColor + '15', borderColor: accentColor + '40' }]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, activeTab === tab.key && { color: accentColor, fontWeight: '700' }]}>
              {tab.label}
            </Text>
            <View style={[styles.tabCount, activeTab === tab.key && { backgroundColor: accentColor }]}>
              <Text style={styles.tabCountText}>{tab.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={accentColor} />
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: listOpacity }}>
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No {activeTab === 'all' ? '' : activeTab + ' '}orders</Text>
              <Text style={styles.emptyDesc}>
                {role === 'client'
                  ? 'Book a worker to see your orders here'
                  : 'Accept bookings to see your orders here'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              renderItem={renderOrder}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  tabRow: {
    flexDirection: 'row', paddingHorizontal: spacing.screenPadding,
    paddingVertical: 12, gap: 8,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  tabText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  tabCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountText: { fontSize: 9, fontWeight: '700', color: colors.white },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  orderCard: {
    backgroundColor: colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12,
  },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  orderAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  orderAvatarText: { fontSize: 16, fontWeight: '700', color: colors.white },
  orderInfo: { flex: 1 },
  orderWorker: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  orderService: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  orderDateRow: { flexDirection: 'row', alignItems: 'center' },
  orderDate: { fontSize: 11, color: colors.textMuted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '600' },

  trackBtn: {
    marginTop: 12, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
  },
  trackBtnText: { fontSize: 13, fontWeight: '600', color: colors.white },
  reviewBtn: {
    marginTop: 12, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.flash + '30',
  },
  reviewBtnText: { fontSize: 13, fontWeight: '600', color: colors.flash },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16, opacity: 0.4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
