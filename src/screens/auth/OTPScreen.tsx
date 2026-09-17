import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';
import { supabase } from '../../api/supabase';
import { upsertWithRetry } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';

type ProfilePayload = Record<string, any>;

export default function OTPScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { accountType, email, profile } = route.params as { accountType: 'client' | 'worker'; email: string; profile: ProfilePayload };
  const { setDirectAuth } = useAuth();
  const accent = accountType === 'client' ? colors.client : colors.primary;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const boxesOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(boxesOpacity, { toValue: 1, duration: 350, delay: 150, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => inputRefs.current[0]?.focus(), 500);
    return () => clearTimeout(timer);
  }, [boxesOpacity, headerOpacity]);

  const handleVerify = async (code: string) => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    try {
      // The Supabase "Confirm signup" email template must use {{ .Token }}
      // so users receive this six-digit code instead of only a web link.
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
      if (error || !data.user) throw error || new Error('We could not verify that code.');

      const { error: profileError } = await upsertWithRetry('profiles', profile);
      if (profileError) throw profileError;
      setDirectAuth(data.user, profile as any);
    } catch (error: any) {
      Alert.alert('Could Not Verify Email', error?.message || 'Check the code and try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    if (digit && index === 5) handleVerify(next.join(''));
  };

  const resendCode = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      Alert.alert('Could Not Resend Code', error?.message || 'Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const isComplete = otp.every(Boolean);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>
      <Animated.View style={[styles.content, { opacity: headerOpacity }]}>
        <Text style={[styles.eyebrow, { color: accent }]}>EMAIL VERIFICATION</Text>
        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit verification code to</Text>
        <Text style={[styles.email, { color: accent }]}>{email}</Text>
      </Animated.View>
      <Animated.View style={[styles.otpContainer, { opacity: boxesOpacity }]}>
        {otp.map((digit, index) => (
          <TextInput key={index} ref={(ref) => { inputRefs.current[index] = ref; }} style={[styles.otpBox, digit && { borderColor: accent, backgroundColor: colors.bgCard }]} value={digit} onChangeText={(text) => handleChange(text, index)} keyboardType="number-pad" maxLength={1} selectTextOnFocus />
        ))}
      </Animated.View>
      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>Didn’t receive it?</Text>
        <Text style={styles.helpText}>Check your inbox and spam folder, then request a new code if needed.</Text>
        <TouchableOpacity onPress={resendCode} disabled={loading}>
          <Text style={[styles.resendText, { color: accent }]}>Resend email code</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={[styles.verifyButton, { backgroundColor: isComplete ? accent : colors.bgCard }]} onPress={() => handleVerify(otp.join(''))} disabled={!isComplete || loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.verifyText}>Verify Email & Create Account</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center', marginLeft: spacing.screenPadding, marginTop: 8 },
  backText: { fontSize: 20, color: colors.white, fontWeight: typography.bold },
  content: { paddingHorizontal: spacing.screenPadding, marginTop: 42 },
  eyebrow: { fontSize: typography.xs, fontWeight: typography.bold, letterSpacing: 1.2, marginBottom: 12 },
  title: { fontSize: typography.xxl, fontWeight: typography.bold, color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: typography.base, color: colors.textSecondary },
  email: { fontSize: typography.md, fontWeight: typography.bold, marginTop: 5 },
  otpContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 42 },
  otpBox: { width: 50, height: 56, borderRadius: spacing.radiusMd, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgInput, textAlign: 'center', fontSize: typography.xxl, fontWeight: typography.bold, color: colors.textPrimary },
  helpCard: { marginHorizontal: spacing.screenPadding, marginTop: 32, backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg, borderWidth: 1, borderColor: colors.border, padding: 16 },
  helpTitle: { color: colors.textPrimary, fontSize: typography.sm, fontWeight: typography.semibold, marginBottom: 6 },
  helpText: { color: colors.textMuted, fontSize: typography.xs, lineHeight: 18 },
  resendText: { fontSize: typography.sm, fontWeight: typography.bold, marginTop: 14 },
  bottomSection: { marginTop: 'auto', paddingHorizontal: spacing.screenPadding, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  verifyButton: { height: spacing.buttonHeight, borderRadius: spacing.radiusLg, alignItems: 'center', justifyContent: 'center' },
  verifyText: { color: colors.white, fontSize: typography.md, fontWeight: typography.bold },
});
