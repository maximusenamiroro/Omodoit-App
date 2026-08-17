import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import type { BookingRow } from '../../lib/workstation';

// One booking row, shared by the Workstation dashboard (which shows the
// first two) and AllBookingsScreen (which shows every one). Callbacks
// are optional so each screen offers only the actions it can honour —
// location sharing needs a broadcast hook that only the dashboard runs.
interface Props {
  booking: BookingRow;
  busy: boolean;
  onRespond?: (id: string, status: 'accepted' | 'declined') => void;
  onComplete?: (booking: BookingRow) => void;
  onMessage?: (booking: BookingRow) => void;
  onToggleShare?: (id: string) => void;
  sharing?: boolean;
}

export function statusStyle(status: string) {
  if (status === 'completed') return { bg: '#06B6D420', text: '#06B6D4' };
  if (status === 'accepted' || status === 'in_progress') return { bg: colors.primary + '20', text: colors.primary };
  if (status === 'declined' || status === 'cancelled' || status === 'expired') return { bg: '#EF444420', text: '#EF4444' };
  return { bg: '#F59E0B20', text: '#F59E0B' };
}

export default function BookingCard({
  booking, busy, onRespond, onComplete, onMessage, onToggleShare, sharing,
}: Props) {
  const status = statusStyle(booking.status);
  const isOpen = booking.status === 'accepted' || booking.status === 'in_progress';

  return (
    <View style={st.card}>
      <View style={st.top}>
        <View style={[st.avatar, { backgroundColor: colors.primary }]}>
          <Text style={st.avatarText}>{booking.clientName[0]}</Text>
        </View>
        <View style={st.info}>
          <Text style={st.client}>{booking.clientName}</Text>
          <Text style={st.job} numberOfLines={1}>{booking.job}</Text>
          <Text style={st.meta}>📍 {booking.location || 'No location'} · {booking.time}</Text>
        </View>
        <View style={[st.badge, { backgroundColor: status.bg }]}>
          <Text style={[st.badgeText, { color: status.text }]}>{booking.status}</Text>
        </View>
      </View>

      {booking.status === 'pending' && onRespond && (
        <View style={st.actions}>
          <PressableScale style={st.declineBtn} onPress={() => onRespond(booking.id, 'declined')} disabled={busy}>
            <Text style={st.declineText}>{busy ? '…' : 'Decline'}</Text>
          </PressableScale>
          <PressableScale style={[st.actionBtn, { backgroundColor: colors.primary }]} onPress={() => onRespond(booking.id, 'accepted')} disabled={busy}>
            <Text style={st.actionText}>{busy ? '…' : 'Accept'}</Text>
          </PressableScale>
        </View>
      )}

      {isOpen && (
        <View style={st.actions}>
          {onMessage && (
            <PressableScale style={[st.actionBtn, st.ghostBtn]} onPress={() => onMessage(booking)}>
              <Text style={[st.actionText, { color: colors.textPrimary }]}>💬 Message</Text>
            </PressableScale>
          )}
          {onToggleShare && (
            <PressableScale
              style={[st.actionBtn, st.ghostBtn, sharing && { borderColor: colors.primary + '50' }]}
              onPress={() => onToggleShare(booking.id)}
            >
              <Text style={[st.actionText, { color: sharing ? colors.primary : colors.textPrimary }]}>
                {sharing ? '📍 Sharing…' : '📍 Share Location'}
              </Text>
            </PressableScale>
          )}
          {onComplete && (
            <PressableScale style={[st.actionBtn, { backgroundColor: colors.primary }]} onPress={() => onComplete(booking)} disabled={busy}>
              <Text style={st.actionText}>{busy ? '…' : '✓ Complete'}</Text>
            </PressableScale>
          )}
        </View>
      )}
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
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  info: { flex: 1 },
  client: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  job: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  meta: { fontSize: 10, color: colors.textMuted, marginTop: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ghostBtn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  actionText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  declineBtn: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: '#EF444440' },
  declineText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
});
