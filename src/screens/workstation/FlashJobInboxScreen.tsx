import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import { respondToBookingRequest } from '../../lib/db';

interface FlashRequest {
  id: string;
  clientId: string;
  clientName: string;
  job: string;
  location: string;
  time: string;
}

const timeAgo = (date: string): string => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  return Math.floor(seconds / 3600) + 'h ago';
};

export default function FlashJobInboxScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
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
        .order('created_at', { ascending: false });

      if (error) throw error;

      const clientIds = [...new Set((rows || []).map((r: any) => r.client_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', clientIds);
        (profileRows || []).forEach((p: any) => { nameMap[p.id] = p.full_name || 'Client'; });
      }

      setRequests((rows || []).map((r: any) => ({
        id: r.id,
        clientId: r.client_id,
        clientName: nameMap[r.client_id] || 'Client',
        job: (r.job_description || '').split('\n')[0].replace('⚡ Flash Job: ', ''),
        location: r.location || '',
        time: timeAgo(r.created_at),
      })));
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

    await respondToBookingRequest(
      requestId, newStatus, clientId, profile?.full_name || '', user?.id || ''
    );

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
                <Text style={st.clientName}>{req.clientName}</Text>
                <Text style={st.job} numberOfLines={2}>{req.job}</Text>
                {!!req.location && <Text style={st.location}>📍 {req.location}</Text>}

                <View style={st.actions}>
                  <TouchableOpacity
                    style={st.declineBtn}
                    onPress={() => handleRespond(req.id, req.clientId, 'declined')}
                    disabled={actioningId === req.id}
                    activeOpacity={0.85}
                  >
                    <Text style={st.declineText}>{actioningId === req.id ? '…' : 'Decline'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={st.acceptBtn}
                    onPress={() => handleRespond(req.id, req.clientId, 'accepted')}
                    disabled={actioningId === req.id}
                    activeOpacity={0.85}
                  >
                    <Text style={st.acceptText}>{actioningId === req.id ? '…' : '⚡ Accept Now'}</Text>
                  </TouchableOpacity>
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
  clientName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  job: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 6 },
  location: { fontSize: 11, color: colors.textMuted, marginBottom: 12 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  declineBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  declineText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  acceptBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.flash, alignItems: 'center' },
  acceptText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
