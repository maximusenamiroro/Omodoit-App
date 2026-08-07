import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Animated, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

type TabKey = 'all' | 'active' | 'completed' | 'cancelled';

interface Order {
  id: string;
  workerName: string;
  service: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  date: string;
  amount: string | null;
  type: 'booking' | 'order';
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#F59E0B', bg: '#F59E0B15' },
  accepted: { label: 'Accepted', color: '#3B82F6', bg: '#3B82F615' },
  in_progress: { label: 'In Progress', color: '#16a34a', bg: '#16a34a15' },
  completed: { label: 'Completed', color: '#06B6D4', bg: '#06B6D415' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bg: '#EF444415' },
};

const MOCK_ORDERS: Order[] = [
  { id: '1', workerName: 'John Adewale', service: 'Electrical Repair', status: 'in_progress', date: '2026-08-02T10:00:00Z', amount: '₦15,000', type: 'booking' },
  { id: '2', workerName: 'Chidinma Okafor', service: 'Catering — 50 guests', status: 'accepted', date: '2026-08-05T14:00:00Z', amount: '₦45,000', type: 'booking' },
  { id: '3', workerName: 'Blessing Eze', service: 'Bridal Makeup', status: 'pending', date: '2026-08-10T08:00:00Z', amount: null, type: 'booking' },
  { id: '4', workerName: 'Emeka Nwosu', service: 'Kitchen Sink Repair', status: 'completed', date: '2026-07-28T11:00:00Z', amount: '₦8,000', type: 'booking' },
  { id: '5', workerName: 'Tunde Bakare', service: 'AC Servicing', status: 'completed', date: '2026-07-25T09:00:00Z', amount: '₦12,000', type: 'booking' },
  { id: '6', workerName: 'David Okonkwo', service: 'Phone Screen Replacement', status: 'cancelled', date: '2026-07-20T16:00:00Z', amount: '₦5,000', type: 'order' },
];

export default function OrdersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const accentColor = role === 'client' ? colors.client : colors.primary;

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(listOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const filteredOrders = MOCK_ORDERS.filter(order => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ['pending', 'accepted', 'in_progress'].includes(order.status);
    if (activeTab === 'completed') return order.status === 'completed';
    if (activeTab === 'cancelled') return order.status === 'cancelled';
    return true;
  });

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: MOCK_ORDERS.length },
    { key: 'active', label: 'Active', count: MOCK_ORDERS.filter(o => ['pending', 'accepted', 'in_progress'].includes(o.status)).length },
    { key: 'completed', label: 'Done', count: MOCK_ORDERS.filter(o => o.status === 'completed').length },
    { key: 'cancelled', label: 'Cancelled', count: MOCK_ORDERS.filter(o => o.status === 'cancelled').length },
  ];

  const renderOrder = ({ item }: { item: Order }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const orderDate = new Date(item.date);
    const dateStr = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = orderDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    return (
      <TouchableOpacity style={styles.orderCard} activeOpacity={0.85}>
        <View style={styles.orderTop}>
          <View style={[styles.orderAvatar, { backgroundColor: accentColor }]}>
            <Text style={styles.orderAvatarText}>{getInitials(item.workerName)}</Text>
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.orderWorker}>{item.workerName}</Text>
            <Text style={styles.orderService}>{item.service}</Text>
            <View style={styles.orderDateRow}>
              <Text style={styles.orderDate}>📅 {dateStr} at {timeStr}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.color + '30' }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Bottom row */}
        <View style={styles.orderBottom}>
          <Text style={styles.orderType}>
            {item.type === 'booking' ? '📋 Booking' : '📦 Order'}
          </Text>
          {item.amount && (
            <Text style={[styles.orderAmount, { color: accentColor }]}>{item.amount}</Text>
          )}
        </View>

        {/* Action buttons based on status */}
        {item.status === 'in_progress' && (
          <TouchableOpacity style={[styles.trackBtn, { backgroundColor: accentColor }]} onPress={() => navigation.navigate('Tracking', { workerName: item.workerName, service: item.service })} activeOpacity={0.85}>
            <Text style={styles.trackBtnText}>📍 Track Worker</Text>
          </TouchableOpacity>
        )}
        {item.status === 'completed' && (
          <TouchableOpacity style={styles.reviewBtn} activeOpacity={0.85}>
            <Text style={styles.reviewBtnText}>⭐ Leave Review</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
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

      {/* Tabs */}
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

  orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderType: { fontSize: 11, color: colors.textMuted },
  orderAmount: { fontSize: 15, fontWeight: '700' },

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
