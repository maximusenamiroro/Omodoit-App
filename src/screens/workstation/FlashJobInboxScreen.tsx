import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import { respondToBookingRequest } from '../../lib/db';
import { parseFlashJob } from '../../lib/flashJob';

interface FlashRequest {
  id: string;
  clientId: string;
  clientName: string;
  service: string;
  budget: string | null;
  landmark: string | null;
  note: string | null;
  location: string;
  time: string;
}

const timeAgo = (date: string): string => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  return Math.floor(seconds / 3600) + 'h ago';
};

// Flash Jobs expire quickly, so anything past the first page is history.
const FLASH_JOB_LIMIT = 50;

export default function FlashJobInboxScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [requests, setRequests] = useState<FlashRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Only flash-broadcast requests (flash_batch_id set), distinct
      // from a regular direct "Book Now" request — matches the
      // "urgent, first to accept wins" nature of Flash Job.
      const { data: rows, error } = await supabase
        .from('hire_requests')
        .select('id, client_id, job_description, location, created_at')
        .eq('worker_id', user.id)
        .eq('status', 'pending')
        .not('flash_batch_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(FLASH_JOB_LIMIT);

      if (error) throw error;

      const clientIds = [...new Set((rows || []).map((r: any) => r.client_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', clientIds);
        (profileRows || []).forEach((p: any) => { nameMap[p.id] = p.full_name || 'Client'; });
      }

      setRequests((rows || []).map((r: any) => {
        // Was `.split('\n')[0]` — which discarded the budget and the
        // client's note, the two things a worker most needs to decide.
        const parsed = parseFlashJob(r.job_description);
        return {
          id: r.id,
          clientId: r.client_id,
          clientName: nameMap[r.client_id] || 'Client',
          service: parsed.service,
          budget: parsed.budget,
          landmark: parsed.landmark,
          note: parsed.note,
          location: r.location || '',
          time: timeAgo(r.created_at),
        };
      }));
    } catch (err) {
      console.error('Failed to load flash job requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadRequests(); }, [loadRequests]));

  const handleRespond = async (requestId: string, clientId: string, newStatus: 'accepted' | 'declined') => {
    if (actioningId) return;
    setActioningId(requestId);

    await respondToBookingRequest(requestId, newStatus);

    loadRequests();
    setActioningId(null);
  };

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <Text style={st.headerTitle}>⚡ Flash Job Inbox</Text>
        <Text style={st.headerSub}>{requests.length} urgent request{requests.length === 1 ? '' : 's'} — first to accept wins</Text>
      </View>

      {loading ? (
        <View style={st.loadingBox}>
          <ActivityIndicator color={colors.flash} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>
          {requests.length === 0 ? (
            <View style={st.emptyBox}>
              <Text style={st.emptyEmoji}>⚡</Text>
              <Text style={st.emptyTitle}>No flash requests right now</Text>
              <Text style={st.emptyDesc}>When a client needs someone urgently in your category, it shows up here first.</Text>
            </View>
          ) : (
            requests.map(req => (
              <View key={req.id} style={st.card}>
                <View style={st.cardTop}>
                  <View style={st.flashBadge}>
                    <Text style={st.flashBadgeText}>⚡ FLASH</Text>
                  </View>
                  <Text style={st.time}>{req.time}</Text>
                </View>

                {/* Service is the headline — it's what the worker is
                    deciding about, so it leads instead of sitting in
                    small grey body text under the client's name. */}
                <Text style={st.service} numberOfLines={2}>{req.service}</Text>

                <View style={st.metaRow}>
                  <Text style={st.metaText} numberOfLines={1}>
                    👤 {req.clientName}
                  </Text>
                  {!!req.location && (
                    <Text style={st.metaText} numberOfLines={1}>
                      📍 {req.location}{req.landmark ? ` · ${req.landmark}` : ''}
                    </Text>
                  )}
                </View>

                {/* The pay. Previously dropped entirely by the parser,
                    so workers were accepting urgent jobs blind. */}
                {req.budget ? (
                  <View style={st.budgetBox}>
                    <Text style={st.budgetLabel}>BUDGET</Text>
                    <Text style={st.budgetValue}>{req.budget}</Text>
                  </View>
                ) : (
                  <View style={[st.budgetBox, st.budgetBoxEmpty]}>
                    <Text style={st.budgetLabel}>BUDGET</Text>
                    <Text style={st.budgetMuted}>Not specified</Text>
                  </View>
                )}

                {!!req.note && (
                  <Text style={st.note} numberOfLines={3}>{req.note}</Text>
                )}

                <View style={st.actions}>
                  <PressableScale
                    style={st.declineBtn}
                    onPress={() => handleRespond(req.id, req.clientId, 'declined')}
                    disabled={actioningId === req.id}
                  >
                    <Text style={st.declineText}>{actioningId === req.id ? '…' : 'Decline'}</Text>
                  </PressableScale>
                  <PressableScale
                    style={st.acceptBtn}
                    onPress={() => handleRespond(req.id, req.clientId, 'accepted')}
                    disabled={actioningId === req.id}
                  >
                    <Text style={st.acceptText}>{actioningId === req.id ? '…' : '⚡ Accept Now'}</Text>
                  </PressableScale>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.screenPadding, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  headerSub: { fontSize: 11, color: colors.flash },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12, opacity: 0.5 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 30, lineHeight: 18 },

  card: { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.flash + '30', padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  flashBadge: { backgroundColor: colors.flash + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  flashBadgeText: { fontSize: 10, fontWeight: '700', color: colors.flash },
  time: { fontSize: 10, color: colors.textMuted },
  // Service headline — the decision the worker is actually making.
  service: { fontSize: 19, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, lineHeight: 24 },

  metaRow: { gap: 3, marginBottom: 12 },
  metaText: { fontSize: 12, color: colors.textMuted },

  // Budget gets its own block rather than a line of body text — it's
  // the number a worker scans for before anything else.
  budgetBox: {
    backgroundColor: colors.flash + '14',
    borderWidth: 1,
    borderColor: colors.flash + '33',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  budgetBoxEmpty: { backgroundColor: colors.bg, borderColor: colors.border },
  budgetLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: 3 },
  budgetValue: { fontSize: 22, fontWeight: '800', color: colors.flash },
  budgetMuted: { fontSize: 15, fontWeight: '600', color: colors.textMuted },

  note: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  declineBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  declineText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  acceptBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.flash, alignItems: 'center' },
  acceptText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
