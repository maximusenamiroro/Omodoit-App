import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, StatusBar, Platform, Alert, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';

export default function BankDetailsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const accentColor = role === 'client' ? colors.client : colors.primary;

  // Payout details are no longer part of the cached profile: they live in
  // payout_accounts, which only their owner can read. profiles is
  // world-readable, so bank details stored there were readable by anyone
  // holding the anon key — which ships inside the app.
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [focused, setFocused] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('payout_accounts')
          .select('bank_name, account_number, account_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (cancelled || !data) return;

        setBankName(data.bank_name || '');
        setAccountNumber(data.account_number || '');
        setAccountName(data.account_name || '');
        setHasExisting(!!(data.bank_name || data.account_number));
      } catch (err) {
        console.error('Could not load payout details:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const isValid = bankName.trim().length > 0 && accountNumber.trim().length >= 10 && accountName.trim().length > 0;

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert('Complete the Form', 'Please fill in your bank name, account number, and account name.');
      return;
    }
    if (!user?.id) return;
    if (saving) return;

    setSaving(true);
    try {
      // upsert rather than update: the first save has no row to update,
      // and user_id is the primary key so a second save replaces it.
      const { error } = await supabase
        .from('payout_accounts')
        .upsert({
          user_id: user.id,
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          account_name: accountName.trim(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setHasExisting(true);

      Alert.alert('Bank Details Saved', 'Your payout details have been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('Bank details save error:', err);
      Alert.alert('Could Not Save', 'Something went wrong. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[st.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={st.backText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Bank Details</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading && <ActivityIndicator color={accentColor} style={st.loader} />}

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}>

        <View style={st.introSection}>
          <View style={[st.iconCircle, { backgroundColor: accentColor + '15' }]}>
            <Text style={st.iconEmoji}>🏦</Text>
          </View>
          <Text style={st.introTitle}>
            {role === 'worker' ? 'Where should we send your earnings?' : 'Your payout details'}
          </Text>
          <Text style={st.introDesc}>
            {role === 'worker'
              ? 'Add your bank account so you can receive payments directly. 0% commission — you keep everything you earn.'
              : 'Used for refunds if a booking or order needs to be reversed.'}
          </Text>
        </View>

        <View style={st.form}>
          <View style={st.field}>
            <Text style={st.label}>Bank Name</Text>
            <TextInput
              style={[st.input, focused === 'bank' && [st.inputFocused, { borderColor: accentColor + '50' }]]}
              value={bankName} onChangeText={setBankName}
              placeholder="e.g. Access Bank, GTBank, Zenith Bank"
              placeholderTextColor={colors.textMuted}
              onFocus={() => setFocused('bank')} onBlur={() => setFocused('')}
            />
          </View>

          <View style={st.field}>
            <Text style={st.label}>Account Number</Text>
            <TextInput
              style={[st.input, focused === 'num' && [st.inputFocused, { borderColor: accentColor + '50' }]]}
              value={accountNumber} onChangeText={(v) => setAccountNumber(v.replace(/[^0-9]/g, ''))}
              placeholder="10-digit account number"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad" maxLength={10}
              onFocus={() => setFocused('num')} onBlur={() => setFocused('')}
            />
          </View>

          <View style={st.field}>
            <Text style={st.label}>Account Name</Text>
            <TextInput
              style={[st.input, focused === 'name' && [st.inputFocused, { borderColor: accentColor + '50' }]]}
              value={accountName} onChangeText={setAccountName}
              placeholder="Name on the account"
              placeholderTextColor={colors.textMuted}
              onFocus={() => setFocused('name')} onBlur={() => setFocused('')}
            />
          </View>

          <View style={st.noticeCard}>
            <Text style={st.noticeIcon}>🔒</Text>
            <Text style={st.noticeText}>Your bank details are private and only used to process your payments.</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[st.bottomBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16 }]}>
        <TouchableOpacity
          style={[st.saveBtn, { backgroundColor: accentColor }, (!isValid || saving) && { opacity: 0.6 }]}
          onPress={handleSave} disabled={!isValid || saving} activeOpacity={0.85}>
          <Text style={st.saveBtnText}>{saving ? 'Saving...' : hasExisting ? '✓ Update Bank Details' : '✓ Save Bank Details'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  loader: { marginTop: 20 },
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  introSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: spacing.screenPadding },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  iconEmoji: { fontSize: 28 },
  introTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  introDesc: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },

  form: { paddingHorizontal: spacing.screenPadding },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  input: { height: 48, backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, fontSize: 14, color: colors.textPrimary },
  inputFocused: { borderWidth: 1.5 },

  noticeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10, marginTop: 4 },
  noticeIcon: { fontSize: 16 },
  noticeText: { flex: 1, fontSize: 11, color: colors.textMuted, lineHeight: 16 },

  bottomBar: { paddingHorizontal: spacing.screenPadding, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  saveBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
