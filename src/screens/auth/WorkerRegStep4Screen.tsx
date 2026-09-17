import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, KeyboardAvoidingView, Platform, StatusBar,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';
import { supabase } from '../../api/supabase';

export default function WorkerRegStep4Screen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const params = route.params;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToConduct, setAgreedToConduct] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;
  const commissionOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(formSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
      Animated.timing(commissionOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const getPasswordStrength = () => {
    if (password.length === 0) return { label: '', color: colors.textMuted, width: '0%' };
    if (password.length < 6) return { label: 'Too short', color: colors.error, width: '20%' };
    if (password.length < 8) return { label: 'Weak', color: colors.flash, width: '40%' };
    let score = 0;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    if (score <= 2) return { label: 'Fair', color: colors.flash, width: '60%' };
    if (score === 3) return { label: 'Good', color: colors.primary, width: '80%' };
    return { label: 'Strong', color: colors.primary, width: '100%' };
  };

  const strength = getPasswordStrength();

  const isFormValid = () => {
    return password.length >= 8 && password === confirmPassword && agreedToTerms && agreedToConduct;
  };

  const handleCreateAccount = async () => {
    if (!isFormValid()) return;
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: params.email,
        password: password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const profileData = {
          id: authData.user.id,
          full_name: params.fullName,
          phone: null,
          location: params.location,
          role: 'worker' as const,
          business_name: params.businessName,
          category: params.category,
          subcategory: params.subcategory,
          experience: params.experience,
          service_area: params.serviceArea,
          verification_level: 1,
          verification_status: 'basic',
          last_seen: new Date().toISOString(),
          avatar_url: null,
          created_at: new Date().toISOString(),
        };

        navigation.replace('OTP', {
          accountType: 'worker',
          email: params.email,
          profile: profileData,
        });
      }
    } catch (error: any) {
      console.error('Registration error:', error);

      let message = 'Something went wrong. Please try again.';
      if (error.message?.includes('already registered')) {
        message = 'An account with this email already exists. Try logging in instead.';
      } else if (error.message) {
        message = error.message;
      }
      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <View style={styles.progressContainer}>
        <Text style={styles.stepText}>Step 4 of 4</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{
          opacity: headerOpacity,
          transform: [{ translateY: headerSlide }],
        }}>
          <Text style={styles.title}>Almost ready to earn!</Text>
          <Text style={styles.subtitle}>
            Secure your account and agree to our worker terms
          </Text>
        </Animated.View>

        {/* Summary */}
        <Animated.View style={[styles.summaryCard, { opacity: headerOpacity }]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Name</Text>
            <Text style={styles.summaryValue}>{params.fullName}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Category</Text>
            <Text style={styles.summaryValue}>{params.subcategory}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Location</Text>
            <Text style={styles.summaryValue}>{params.location}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Area</Text>
            <Text style={styles.summaryValue}>{params.serviceArea}</Text>
          </View>
        </Animated.View>

        {/* Password form */}
        <Animated.View style={{
          opacity: formOpacity,
          transform: [{ translateY: formSlide }],
        }}>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Password *</Text>
            <View style={[styles.passwordRow, focused === 'password' && styles.inputFocused]}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a strong password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused('')}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthTrack}>
                  <View style={[styles.strengthFill, { width: strength.width as any, backgroundColor: strength.color }]} />
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              </View>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Confirm Password *</Text>
            <View style={[
              styles.passwordRow,
              focused === 'confirm' && styles.inputFocused,
              confirmPassword.length > 0 && password === confirmPassword && styles.inputValid,
              confirmPassword.length > 0 && password !== confirmPassword && styles.inputError,
            ]}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused('')}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeButton}>
                <Text style={styles.eyeText}>{showConfirm ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.errorHint}>Passwords do not match</Text>
            )}
            {confirmPassword.length > 0 && password === confirmPassword && (
              <Text style={styles.successHint}>✓ Passwords match</Text>
            )}
          </View>

          {/* Terms */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink}>Terms of Use</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAgreedToConduct(!agreedToConduct)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreedToConduct && styles.checkboxChecked]}>
              {agreedToConduct && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I will provide honest and quality services to all clients
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Commission card — the hook */}
        <Animated.View style={[styles.commissionCard, { opacity: commissionOpacity }]}>
          <Text style={styles.commissionEmoji}>💰</Text>
          <View style={styles.commissionInfo}>
            <Text style={styles.commissionTitle}>You keep 100% of your earnings</Text>
            <Text style={styles.commissionDesc}>
              Omodoit takes 0% commission from your jobs. We earn through subscriptions, not your hard work.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={{ opacity: buttonOpacity }}>
          <TouchableOpacity
            style={[
              styles.createButton,
              !isFormValid() && styles.createButtonDisabled,
            ]}
            onPress={handleCreateAccount}
            disabled={!isFormValid() || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.createText}>Create My Worker Account</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.securityNote}>
            🔒 Your password is encrypted and never stored in plain text
          </Text>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: spacing.screenPadding, paddingBottom: 16 },

  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white + '08',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing.screenPadding, marginTop: 8, marginBottom: 4,
  },
  backText: { fontSize: 20, color: colors.white, fontWeight: typography.bold },

  progressContainer: { paddingHorizontal: spacing.screenPadding, marginBottom: 20, marginTop: 8 },
  stepText: { fontSize: typography.xs, fontWeight: typography.medium, color: colors.primary, marginBottom: 8 },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },

  title: { fontSize: typography.xxl, fontWeight: typography.bold, color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: typography.base, color: colors.textSecondary, lineHeight: 22, marginBottom: 16 },

  summaryCard: {
    backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  summaryLabel: { fontSize: typography.sm, color: colors.textMuted },
  summaryValue: { fontSize: typography.sm, color: colors.textPrimary, fontWeight: typography.medium },
  summaryDivider: { height: 1, backgroundColor: colors.border },

  fieldContainer: { marginBottom: 20 },
  fieldLabel: { fontSize: typography.sm, fontWeight: typography.medium, color: colors.textSecondary, marginBottom: 8 },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    height: spacing.inputHeight, backgroundColor: colors.bgInput,
    borderRadius: spacing.radiusMd, borderWidth: 1.5, borderColor: colors.border,
  },
  inputFocused: { borderColor: colors.primary + '50' },
  inputValid: { borderColor: colors.primary + '50' },
  inputError: { borderColor: colors.error + '50' },
  passwordInput: { flex: 1, paddingHorizontal: 16, fontSize: typography.base, color: colors.textPrimary },
  eyeButton: { paddingHorizontal: 14, paddingVertical: 14 },
  eyeText: { fontSize: 18 },
  errorHint: { fontSize: typography.xs, color: colors.error, marginTop: 6 },
  successHint: { fontSize: typography.xs, color: colors.primary, marginTop: 6 },

  strengthContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  strengthTrack: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, marginRight: 10 },
  strengthFill: { height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: typography.xs, fontWeight: typography.semibold, width: 60 },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center',
    marginRight: 12, marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  checkmark: { fontSize: 12, fontWeight: typography.bold, color: colors.primary },
  termsText: { flex: 1, fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20 },
  termsLink: { color: colors.primary, fontWeight: typography.medium },

  commissionCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.primary + '08', borderRadius: spacing.radiusLg,
    borderWidth: 1, borderColor: colors.primary + '25', padding: 16, marginBottom: 8,
  },
  commissionEmoji: { fontSize: 24, marginRight: 14, marginTop: 2 },
  commissionInfo: { flex: 1 },
  commissionTitle: { fontSize: typography.base, fontWeight: typography.bold, color: colors.textPrimary, marginBottom: 4 },
  commissionDesc: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20 },

  bottomSection: {
    paddingHorizontal: spacing.screenPadding, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  createButton: {
    height: spacing.buttonHeight, borderRadius: spacing.radiusLg,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, marginBottom: 12,
  },
  createButtonDisabled: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  createText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.white },
  securityNote: { fontSize: typography.xs, color: colors.textMuted, textAlign: 'center' },
});
