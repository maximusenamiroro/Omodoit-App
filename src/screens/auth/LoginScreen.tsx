import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, KeyboardAvoidingView, Platform, StatusBar,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';
import { supabase } from '../../api/supabase';

export default function LoginScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  // Email is the account identifier. It always was — the phone branch
  // here only ever ended in "please use your email instead".
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');

  // Animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(20)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const registerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, damping: 15, stiffness: 120, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(formSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(registerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [buttonOpacity, formOpacity, formSlide, logoOpacity, logoScale, registerOpacity, titleOpacity, titleSlide]);

  const isFormValid = () => {
    return email.trim().length >= 4 && password.length >= 6;
  };

  const handleLogin = async () => {
    if (!isFormValid()) return;

    setLoading(true);

    try {
      const loginEmail = email.trim().toLowerCase();

      // Login with email + password
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (error) throw error;

      // AuthContext onAuthStateChange will detect the session
      // and navigate to the correct home screen automatically

    } catch (error: any) {
      console.error('Login error:', error);

      // Security: use generic error message
      // Never reveal if the email exists or if only the password is wrong
      let message = 'The email or password you entered is incorrect. Please check and try again.';

      if (error.message?.includes('Invalid login')) {
        message = 'The email or password you entered is incorrect. Please check and try again.';
      } else if (error.message?.includes('Email not confirmed')) {
        message = 'Please verify your email before logging in. Check your inbox for a confirmation link.';
      } else if (error.message?.includes('too many requests')) {
        message = 'Too many login attempts. Please wait a few minutes and try again.';
      }

      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        'Enter Email',
        'Please enter your email address above, then tap Forgot Password to receive a reset link.'
      );
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
      );

      if (error) throw error;

      Alert.alert(
        'Check Your Email',
        'If an account exists with this email, we have sent a password reset link. Check your inbox.',
        [{ text: 'OK' }]
      );
    } catch {
      // Security: always show the same message regardless of whether
      // the email exists — prevents account enumeration
      Alert.alert(
        'Check Your Email',
        'If an account exists with this email, we have sent a password reset link. Check your inbox.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, {
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
        }]}>
          <View style={styles.logoBox}>
            <Text style={styles.logoO}>O</Text>
          </View>
          <Text style={styles.appName}>omodoit</Text>
          <Text style={styles.tagline}>Find. Book. Track.</Text>
        </Animated.View>

        {/* Title */}
        <Animated.View style={{
          opacity: titleOpacity,
          transform: [{ translateY: titleSlide }],
        }}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View style={{
          opacity: formOpacity,
          transform: [{ translateY: formSlide }],
        }}>
          {/* Email field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={[
                styles.input,
                focused === 'email' && styles.inputFocused,
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused('')}
            />
          </View>

          {/* Password field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={[
              styles.passwordRow,
              focused === 'password' && styles.inputFocused,
            ]}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused('')}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotContainer}
            onPress={handleForgotPassword}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Bottom section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        {/* Login button */}
        <Animated.View style={{ opacity: buttonOpacity }}>
          <TouchableOpacity
            style={[
              styles.loginButton,
              !isFormValid() && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={!isFormValid() || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Register link */}
        <Animated.View style={[styles.registerRow, { opacity: registerOpacity }]}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('AccountType')}>
            <Text style={styles.registerLink}>Sign Up</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 16,
  },

  // Back
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white + '08',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing.screenPadding, marginTop: 8, marginBottom: 4,
  },
  backText: {
    fontSize: 20, color: colors.white, fontWeight: typography.bold,
  },

  // Logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 16,
  },
  logoBox: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  logoO: {
    fontSize: 32, fontWeight: typography.bold, color: colors.white,
  },
  appName: {
    fontSize: typography.xl, fontWeight: typography.bold,
    color: colors.white, letterSpacing: -0.5,
  },
  tagline: {
    fontSize: typography.xs, color: colors.textMuted,
    marginTop: 4, letterSpacing: 2,
  },

  // Title
  title: {
    fontSize: typography.xxl, fontWeight: typography.bold,
    color: colors.textPrimary, marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.base, color: colors.textSecondary,
    marginBottom: 28,
  },

  // Fields
  fieldContainer: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: typography.sm, fontWeight: typography.medium,
    color: colors.textSecondary, marginBottom: 8,
  },
  input: {
    height: spacing.inputHeight,
    backgroundColor: colors.bgInput,
    borderRadius: spacing.radiusMd,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.primary + '50',
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    height: spacing.inputHeight,
    backgroundColor: colors.bgInput,
    borderRadius: spacing.radiusMd,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 16,
    fontSize: typography.base, color: colors.textPrimary,
  },
  eyeButton: {
    paddingHorizontal: 14, paddingVertical: 14,
  },
  eyeText: { fontSize: 18 },

  // Forgot
  forgotContainer: {
    alignItems: 'flex-end',
    marginTop: -6,
    marginBottom: 8,
  },
  forgotText: {
    fontSize: typography.sm, fontWeight: typography.medium,
    color: colors.primary,
  },

  // Bottom
  bottomSection: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  loginButton: {
    height: spacing.buttonHeight,
    borderRadius: spacing.radiusLg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginButtonDisabled: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loginButtonText: {
    fontSize: typography.md, fontWeight: typography.bold,
    color: colors.white,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerText: {
    fontSize: typography.base, color: colors.textSecondary,
  },
  registerLink: {
    fontSize: typography.base, fontWeight: typography.bold,
    color: colors.primary,
  },
});