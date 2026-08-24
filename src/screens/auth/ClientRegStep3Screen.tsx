import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  Animated, KeyboardAvoidingView, Platform, StatusBar,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASING, colors, typography, spacing, useEntrance } from '../../theme';
import Icon from '../../components/common/Icon';
import PressableScale from '../../components/common/PressableScale';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { upsertWithRetry } from '../../lib/db';

export default function ClientRegStep3Screen({ navigation, route }: any) {
  const entrance = useEntrance();
  const insets = useSafeAreaInsets();
  const { fullName, email, location } = route.params;
  const { setDirectAuth, beginRegistration, endRegistration } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;
  const benefitsOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(entrance.stagger, [
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
        Animated.spring(formSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
      Animated.timing(benefitsOpacity, { toValue: 1, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 1, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
    ]).start();
  }, [benefitsOpacity, buttonOpacity, formOpacity, formSlide, headerOpacity, headerSlide]);

  // Password strength
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
    return (
      password.length >= 8 &&
      password === confirmPassword &&
      agreedToTerms
    );
  };

  const handleCreateAccount = async () => {
    if (!isFormValid()) return;

    setLoading(true);

    // Block AuthContext's SIGNED_IN listener BEFORE signUp fires it.
    // Otherwise it fetches the (not yet created) profile, finds nothing,
    // and the navigator flashes back to the first signup screen.
    beginRegistration();

    try {
      // Step 1: Create the account with Supabase Auth
      // Carried as user_metadata so AuthContext can rebuild this
      // profile correctly if the write below fails — see the worker
      // flow for why a hardcoded fallback role was a problem.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            role: 'client',
            full_name: fullName,
            location: location,
          },
        },
      });

      if (authError) throw authError;

      // With email confirmation enabled, signUp() returns a user but no
      // session. Nothing signed in means auth.uid() is null, so the
      // profile insert below would be refused by RLS — and every field
      // needed to build it is already stored as user_metadata, which
      // AuthContext writes out on first successful sign-in. So stop
      // here and send them to their inbox.
      if (!authData.session) {
        setLoading(false);
        Alert.alert(
          'Check Your Email',
          `We sent a confirmation link to ${email}. Open it to activate your account, then log in.`,
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
        return;
      }

      if (authData.user) {
        // Step 2: Create the profile in the profiles table
        const profileData = {
          id: authData.user.id,
          full_name: fullName,
          location: location,
          role: 'client' as const,
          verification_level: 1,
          verification_status: 'basic',
          last_seen: new Date().toISOString(),
          avatar_url: null,
          created_at: new Date().toISOString(),
        };

        const { error: profileError } = await upsertWithRetry('profiles', profileData);

        if (profileError) {
          // Do NOT proceed to setDirectAuth — that would show the user
          // as fully logged in locally while no profile row actually
          // exists. They'd appear fine this session, then get locked
          // out next launch with no way to fix it themselves (their
          // email is already registered, so they can't just sign up
          // again). Surface it now instead, while it's still fixable.
          throw new Error(
            "Your account was created but we couldn't finish setting up " +
            'your profile. Please try logging in — this usually resolves ' +
            'itself, and if not, try again in a moment.'
          );
        }

        // Step 3: Directly set user and profile in AuthContext
        // This bypasses the race condition completely.
        // Instead of waiting for onAuthStateChange to fire
        // and fetchProfile to find the profile, we tell
        // AuthContext exactly what the user and profile are.
        // AppNavigator immediately renders ClientNavigator.
        setDirectAuth(authData.user, {
          id: authData.user.id,
          full_name: fullName,
          avatar_url: null,
          role: 'client',
          location: location,
          verification_level: 1,
          verification_status: 'basic',
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.error('Registration error:', error);

      // Registration failed — re-enable normal auth handling
      endRegistration();

      let message = 'Something went wrong. Please try again.';

      if (error.message?.includes('already registered')) {
        message = 'An account with this email already exists. Try logging in instead.';
      } else if (error.message?.includes('password')) {
        message = 'Password must be at least 8 characters long.';
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

      {/* Back */}
      <PressableScale
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="back" size={20} color={colors.white} />
      </PressableScale>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <Text style={[styles.stepText, { color: colors.client }]}>Step 3 of 3</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '100%', backgroundColor: colors.client }]} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View style={{
          opacity: headerOpacity,
          transform: [{ translateY: headerSlide }],
        }}>
          <Text style={styles.title}>Secure your account</Text>
          <Text style={styles.subtitle}>
            Create a strong password to protect your Omodoit account
          </Text>
        </Animated.View>

        {/* Summary */}
        <Animated.View style={[styles.summaryCard, { opacity: headerOpacity }]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Name</Text>
            <Text style={styles.summaryValue}>{fullName}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Email</Text>
            <Text style={styles.summaryValue}>{email}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Location</Text>
            <Text style={styles.summaryValue}>{location}</Text>
          </View>
        </Animated.View>

        {/* Password form */}
        <Animated.View style={{
          opacity: formOpacity,
          transform: [{ translateY: formSlide }],
        }}>
          {/* Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Password *</Text>
            <View style={[
              styles.passwordRow,
              focused === 'password' && styles.inputFocused,
            ]}>
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
              <PressableScale
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
              </PressableScale>
            </View>

            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthTrack}>
                  <View style={[
                    styles.strengthFill,
                    { width: strength.width as any, backgroundColor: strength.color },
                  ]} />
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm */}
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
              <PressableScale
                onPress={() => setShowConfirm(!showConfirm)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>{showConfirm ? '🙈' : '👁'}</Text>
              </PressableScale>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.errorHint}>Passwords do not match</Text>
            )}
            {confirmPassword.length > 0 && password === confirmPassword && (
              <Text style={styles.successHint}>✓ Passwords match</Text>
            )}
          </View>

          {/* Terms */}
          <PressableScale
            style={styles.termsRow}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
          >
            <View style={[
              styles.checkbox,
              agreedToTerms && styles.checkboxChecked,
            ]}>
              {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.termsLink}>Terms of Use</Text>
              {' '}and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </PressableScale>
        </Animated.View>

        {/* Benefits */}
        <Animated.View style={[styles.benefitsCard, { opacity: benefitsOpacity }]}>
          <Text style={styles.benefitsTitle}>Your client account includes:</Text>
          {[
            { icon: '🔍', text: 'Browse hundreds of verified workers' },
            { icon: '⚡', text: 'Flash Job — instant urgent hiring' },
            { icon: '📍', text: 'Real-time GPS tracking' },
            { icon: '💬', text: 'Secure in-app messaging and calls' },
          ].map((item, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={styles.benefitIconBg}>
                <Text style={styles.benefitIcon}>{item.icon}</Text>
              </View>
              <Text style={styles.benefitText}>{item.text}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Bottom */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={{ opacity: buttonOpacity }}>
          <PressableScale
            style={[
              styles.createButton,
              { backgroundColor: isFormValid() ? colors.client : colors.bgCard },
              !isFormValid() && styles.createButtonDisabled,
            ]}
            onPress={handleCreateAccount}
            disabled={!isFormValid() || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.createText}>Create My Account</Text>
            )}
          </PressableScale>

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
  stepText: { fontSize: typography.xs, fontWeight: typography.medium, marginBottom: 8 },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2 },
  progressFill: { height: 4, borderRadius: 2 },

  title: {
    fontSize: typography.xxl, fontWeight: typography.bold,
    color: colors.textPrimary, marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.base, color: colors.textSecondary,
    lineHeight: 22, marginBottom: 16,
  },

  summaryCard: {
    backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  summaryLabel: { fontSize: typography.sm, color: colors.textMuted },
  summaryValue: { fontSize: typography.sm, color: colors.textPrimary, fontWeight: typography.medium },
  summaryDivider: { height: 1, backgroundColor: colors.border },

  fieldContainer: { marginBottom: 20 },
  fieldLabel: {
    fontSize: typography.sm, fontWeight: typography.medium,
    color: colors.textSecondary, marginBottom: 8,
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    height: spacing.inputHeight, backgroundColor: colors.bgInput,
    borderRadius: spacing.radiusMd, borderWidth: 1.5,
    borderColor: colors.border,
  },
  inputFocused: { borderColor: colors.client + '50' },
  inputValid: { borderColor: colors.primary + '50' },
  inputError: { borderColor: colors.error + '50' },
  passwordInput: {
    flex: 1, paddingHorizontal: 16,
    fontSize: typography.base, color: colors.textPrimary,
  },
  eyeButton: { paddingHorizontal: 14, paddingVertical: 14 },
  eyeText: { fontSize: 18 },
  errorHint: { fontSize: typography.xs, color: colors.error, marginTop: 6 },
  successHint: { fontSize: typography.xs, color: colors.primary, marginTop: 6 },

  strengthContainer: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8,
  },
  strengthTrack: {
    flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, marginRight: 10,
  },
  strengthFill: { height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: typography.xs, fontWeight: typography.semibold, width: 60 },

  termsRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center',
    marginRight: 12, marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.client + '20', borderColor: colors.client,
  },
  checkmark: { fontSize: 12, fontWeight: typography.bold, color: colors.client },
  termsText: { flex: 1, fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20 },
  termsLink: { color: colors.client, fontWeight: typography.medium },

  benefitsCard: {
    backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg,
    borderWidth: 1, borderColor: colors.client + '15',
    padding: 16,
  },
  benefitsTitle: {
    fontSize: typography.sm, fontWeight: typography.semibold,
    color: colors.textPrimary, marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  benefitIconBg: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: colors.client + '10',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  benefitIcon: { fontSize: 14 },
  benefitText: { fontSize: typography.sm, color: colors.textSecondary },

  bottomSection: {
    paddingHorizontal: spacing.screenPadding, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  createButton: {
    height: spacing.buttonHeight, borderRadius: spacing.radiusLg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  createButtonDisabled: { borderWidth: 1, borderColor: colors.border },
  createText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.white },
  securityNote: {
    fontSize: typography.xs, color: colors.textMuted, textAlign: 'center',
  },
});