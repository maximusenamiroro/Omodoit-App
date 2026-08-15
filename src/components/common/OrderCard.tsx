import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors, spacing } from '../../theme';
import type { ProductOrderRow } from '../../lib/workstation';
import { statusStyle } from './BookingCard';

// One product order as the seller sees it. Same card on the Workstation
// dashboard (first two) and AllOrdersScreen (all of them).
interface Props {
  order: ProductOrderRow;
  busy: boolean;
  onAdvance?: (order: ProductOrderRow, next: 'accepted' | 'completed' | 'cancelled') => void;
  onMessage?: (order: ProductOrderRow) => void;
}

export default function OrderCard({ order, busy, onAdvance, onMessage }: Props) {
  const status = statusStyle(order.status);

  return (
    <View style={st.card}>
      <View style={st.top}>
        {order.productImageUrl ? (
          <Image source={{ uri: order.productImageUrl }} style={st.thumb} />
        ) : (
          <View style={[st.thumb, st.thumbFallback]}>
            <Text style={st.thumbEmoji}>📦</Text>
          </View>
        )}
        <View style={st.info}>
          <Text style={st.product} numberOfLines={1}>{order.productName}</Text>
          <Text style={st.buyer}>by {order.buyerName}</Text>
          <Text style={st.meta}>
            {order.quantity > 1 ? `×${order.quantity} · ` : ''}
            {order.total != null ? `₦${order.total.toLocaleString()}` : 'Price on request'} · {order.time}
          </Text>
        </View>
        <View style={[st.badge, { backgroundColor: status.bg }]}>
          <Text style={[st.badgeText, { color: status.text }]}>{order.status}</Text>
        </View>
      </View>

      <View style={st.actions}>
        {onMessage && (
          <TouchableOpacity style={[st.actionBtn, st.ghostBtn]} onPress={() => onMessage(order)} activeOpacity={0.85}>
            <Text style={[st.actionText, { color: colors.textPrimary }]}>💬 Message</Text>
          </TouchableOpacity>
        )}
        {onAdvance && order.status === 'pending' && (
          <>
            <TouchableOpacity style={[st.actionBtn, st.declineBtn]} onPress={() => onAdvance(order, 'cancelled')} disabled={busy} activeOpacity={0.85}>
              <Text style={[st.actionText, { color: '#EF4444' }]}>{busy ? '…' : 'Decline'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.actionBtn, { backgroundColor: colors.primary }]} onPress={() => onAdvance(order, 'accepted')} disabled={busy} activeOpacity={0.85}>
              <Text style={st.actionText}>{busy ? '…' : 'Accept'}</Text>
            </TouchableOpacity>
          </>
        )}
        {onAdvance && order.status === 'accepted' && (
          <TouchableOpacity style={[st.actionBtn, { backgroundColor: colors.primary }]} onPress={() => onAdvance(order, 'completed')} disabled={busy} activeOpacity={0.85}>
            <Text style={st.actionText}>{busy ? '…' : '✓ Mark Delivered'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    marginHorizontal: spacing.screenPadding, marginBottom: 10, padding: 14,
    borderRadius: 16, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  top: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 46, height: 46, borderRadius: 12, marginRight: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white + '08' },
  thumbEmoji: { fontSize: 20 },
  info: { flex: 1 },
  product: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  buyer: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  meta: { fontSize: 10, color: colors.textMuted, marginTop: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ghostBtn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  declineBtn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: '#EF444440' },
  actionText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
