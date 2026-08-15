import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import OrderCard from '../../components/common/OrderCard';
import { fetchWorkerOrders, setOrderStatus, type ProductOrderRow } from '../../lib/workstation';

// Every product order placed against this worker's listings. The
// Workstation dashboard shows the two most recent; this is the rest.
const PAGE_SIZE = 20;

export default function AllOrdersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [orders, setOrders] = useState<ProductOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setReachedEnd(false);
    try {
      const rows = await fetchWorkerOrders(user.id, { limit: PAGE_SIZE });
      setOrders(rows);
      setReachedEnd(rows.length < PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!user?.id || loading || loadingMore || reachedEnd) return;
    setLoadingMore(true);
    try {
      const rows = await fetchWorkerOrders(user.id, { limit: PAGE_SIZE, offset: orders.length });
      setOrders(prev => {
        const seen = new Set(prev.map(o => o.id));
        return [...prev, ...rows.filter(r => !seen.has(r.id))];
      });
      setReachedEnd(rows.length < PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more orders:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const advance = async (order: ProductOrderRow, next: 'accepted' | 'completed' | 'cancelled') => {
    if (actioningId) return;
    setActioningId(order.id);
    try {
      const allowedFrom = next === 'completed' ? ['accepted', 'in_progress'] : ['pending'];
      const changed = await setOrderStatus(order.id, next, allowedFrom);
      if (!changed) {
        Alert.alert('Could Not Update', 'This order may have already changed status.');
      } else {
        setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, status: next } : o)));
      }
    } catch (err) {
      console.error('Failed to update order:', err);
      Alert.alert('Something Went Wrong', 'Could not update this order. Please try again.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={st.backText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>All Orders</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={st.emptyBox}>
              <Text style={st.emptyEmoji}>🛒</Text>
              <Text style={st.emptyTitle}>No orders yet</Text>
              <Text style={st.emptySub}>Orders for the products you post will show up here.</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              busy={actioningId === item.id}
              onAdvance={advance}
              onMessage={o => navigation.navigate('Chat', {
                otherUserId: o.buyerId, otherUserName: o.buyerName, otherUserAvatar: null,
              })}
            />
          )}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 12, opacity: 0.4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
