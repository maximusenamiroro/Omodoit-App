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

interface CompletedJob {
  id: string;
  clientName: string;
  job: string;
  date: string;
}

// A worker's completed-job history is a record, not a feed. The screen
// shows the recent ones; the total is what matters above it.
const COMPLETED_JOBS_LIMIT = 100;

export default function EarningsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('hire_requests')
        .select('id, client_id, job_description, created_at')
        .eq('worker_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(COMPLETED_JOBS_LIMIT);

      if (error) throw error;

      const clientIds = [...new Set((rows || []).map((r: any) => r.client_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', clientIds);
        (profileRows || []).forEach((p: any) => { nameMap[p.id] = p.full_name || 'Client'; });
      }

      setJobs((rows || []).map((r: any) => ({
        id: r.id,
        clientName: nameMap[r.client_id] || 'Client',
        job: (r.job_description || '').split('\n')[0].slice(0, 50),
        date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })));
    } catch (err) {
      console.error('Failed to load completed jobs:', err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadJobs(); }, [loadJobs]));

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <PressableScale style={st.backBtn} onPress={() => navigation.goBack()}>
          <Text style={st.backText}>←</Text>
        </PressableScale>
        <Text style={st.headerTitle}>💰 Earnings</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={st.loadingBox}><ActivityIndicator color="#06B6D4" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>

          <View style={st.summaryCard}>
            <Text style={st.summaryValue}>{jobs.length}</Text>
            <Text style={st.summaryLabel}>Jobs Completed</Text>
          </View>

          {/* Honest limitation: there's no payment processing wired up
              yet, so there's no real, structured record of how much
              was actually paid per job — showing a fabricated Naira
              total here would be worse than not showing one at all.
              This becomes a real total once payments are integrated
              (e.g. Paystack) and each transaction is recorded. */}
          <View style={st.noticeCard}>
            <Text style={st.noticeIcon}>ℹ️</Text>
            <Text style={st.noticeText}>
              Omodoit doesn't process payments yet, so there's no way to show a real earnings total —
              clients and workers currently settle payment directly. Once in-app payments are added,
              your real earnings will appear here automatically.
            </Text>
          </View>

          <Text style={st.sectionTitle}>Completed Jobs</Text>
          {jobs.length === 0 ? (
            <View style={st.emptyBox}>
              <Text style={st.emptyEmoji}>💰</Text>
              <Text style={st.emptyTitle}>No completed jobs yet</Text>
              <Text style={st.emptyDesc}>Mark a job as complete from your Workstation to see it here.</Text>
            </View>
          ) : (
            jobs.map(job => (
              <View key={job.id} style={st.jobCard}>
                <View style={st.jobInfo}>
                  <Text style={st.jobClient}>{job.clientName}</Text>
                  <Text style={st.jobDesc} numberOfLines={1}>{job.job}</Text>
                </View>
                <Text style={st.jobDate}>{job.date}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  summaryCard: { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center', marginBottom: 16 },
  summaryValue: { fontSize: 36, fontWeight: '800', color: '#06B6D4', marginBottom: 4 },
  summaryLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },

  noticeCard: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10, marginBottom: 20 },
  noticeIcon: { fontSize: 16 },
  noticeText: { flex: 1, fontSize: 11, color: colors.textMuted, lineHeight: 17 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  jobCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  jobInfo: { flex: 1 },
  jobClient: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  jobDesc: { fontSize: 11, color: colors.textMuted },
  jobDate: { fontSize: 10, color: colors.textMuted },

  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 36, marginBottom: 10, opacity: 0.4 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  emptyDesc: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
