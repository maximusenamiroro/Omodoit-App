import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, KeyboardAvoidingView, Platform, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';

export default function PhoneVerifyScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { accountType } = route.params;
  const isClient = accountType === 'client';
  const accent = isClient ? colors.client : colors.primary;

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;
  const inputSlide = useRef(new Animated.Value(30)).current;
  const trustOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const animations = [
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(inputOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(inputSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
      Animated.timing(trustOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(buttonSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ];
    Animated.stagger(150, animations).start();

    // Auto-focus the input after animation
    setTimeout(() => inputRef.current?.focus(), 600);
  }, [buttonOpacity, buttonSlide, headerOpacity, headerSlide, inputOpacity, inputSlide, trustOpacity]);

  // Format phone number as user types
  // Input: 8050963733 → Display: 805 096 3733
  const formatPhone = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/[^0-9]/g, '');

    // Limit to 11 digits (Nigerian format: 0XXXXXXXXXX)
    // or 10 digits without leading 0
    const limited = cleaned.slice(0, 11);
    setPhone(limited);
  };

  // Validate Nigerian phone number
  const isValidPhone = () => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    // Must be 10 or 11 digits
    // 11 digits: starts with 0 (e.g. 08050963733)
    // 10 digits: without leading 0 (e.g. 8050963733)
    if (cleaned.length === 11 && cleaned.startsWith('0')) return true;
    if (cleaned.length === 10 && !cleaned.startsWith('0')) return true;
    return false;
  };

  // Format for display with spaces
  const displayPhone = () => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length <= 10) return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  };

  // Get the full international format
  const getInternationalPhone = () => {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    return `+234${cleaned}`;
  };

  const handleSendCode = async () => {
    if (!isValidPhone()) {
      Alert.alert('Invalid Number', 'Please enter a valid Nigerian phone number');
      return;
    }

    setLoading(true);

    // TODO: Replace with actual Termii API call
    // For now simulate OTP sending
    setTimeout(() => {
      setLoading(false);
      navigation.navigate('OTP', {
        accountType,
        phoneNumber: getInternationalPhone(),
      });
    }, 1500);
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

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <Text style={[styles.stepText, { color: accent }]}>
          Step 1 of {isClient ? '3' : '4'}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[
            styles.progressFill,
            { width: isClient ? '33%' : '25%', backgroundColor: accent },
          ]} />
        </View>
      </View>

      {/* Header */}
      <Animated.View style={{
        opacity: headerOpacity,
        transform: [{ translateY: headerSlide }],
        paddingHorizontal: spacing.screenPadding,
      }}>
        <Text style={styles.title}>Verify your phone</Text>
        <Text style={styles.subtitle}>
          We'll send you a verification code to confirm your number. This keeps the platform safe for everyone.
        </Text>
      </Animated.View>

      {/* Phone input */}
      <Animated.View style={[styles.inputSection, {
        opacity: inputOpacity,
        transform: [{ translateY: inputSlide }],
      }]}>
        <Text style={styles.inputLabel}>Phone Number</Text>

        <View style={[styles.phoneRow, { borderColor: phone.length > 0 ? accent + '50' : colors.border }]}>
          {/* Country code — fixed */}
          <View style={styles.countryCode}>
            <Text style={styles.flag}>🇳🇬</Text>
            <Text style={styles.codeText}>+234</Text>
            <Text style={styles.divider}>|</Text>
          </View>

          {/* Phone input */}
          <TextInput
            ref={inputRef}
            style={styles.phoneInput}
            value={displayPhone()}
            onChangeText={formatPhone}
            placeholder="805 096 3733"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            maxLength={14}
          />

          {/* Checkmark when valid */}
          {isValidPhone() && (
            <View style={[styles.validBadge, { backgroundColor: accent + '20' }]}>
              <Text style={[styles.validCheck, { color: accent }]}>✓</Text>
            </View>
          )}
        </View>

        <Text style={styles.inputHint}>
          Enter your number without the leading zero
        </Text>
      </Animated.View>

      {/* Trust signals */}
      <Animated.View style={[styles.trustSection, { opacity: trustOpacity }]}>
        <View style={styles.trustCard}>
          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>🔒</Text>
            <View style={styles.trustTextContainer}>
              <Text style={styles.trustTitle}>Your number stays private</Text>
              <Text style={styles.trustDesc}>
                We never share it with {isClient ? 'workers' : 'clients'} unless you choose to
              </Text>
            </View>
          </View>

          <View style={styles.trustDivider} />

          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>📱</Text>
            <View style={styles.trustTextContainer}>
              <Text style={styles.trustTitle}>One account per number</Text>
              <Text style={styles.trustDesc}>
                Prevents fake accounts and keeps everyone safe
              </Text>
            </View>
          </View>

          <View style={styles.trustDivider} />

          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>⚡</Text>
            <View style={styles.trustTextContainer}>
              <Text style={styles.trustTitle}>Code arrives in seconds</Text>
              <Text style={styles.trustDesc}>
                Works on MTN, Airtel, GLO, and 9mobile
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Bottom section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={{
          opacity: buttonOpacity,
          transform: [{ translateY: buttonSlide }],
        }}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: isValidPhone() ? accent : colors.bgCard },
              !isValidPhone() && styles.sendButtonDisabled,
            ]}
            onPress={handleSendCode}
            disabled={!isValidPhone() || loading}
            activeOpacity={0.85}
          >
            <Text style={styles.sendButtonText}>
              {loading ? 'Sending code...' : 'Send Verification Code'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={styles.loginRow}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginText}>Already have an account? </Text>
          <Text style={[styles.loginLink, { color: accent }]}>Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Back button
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white + '08',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.screenPadding,
    marginTop: 8,
    marginBottom: 4,
  },
  backText: {
    fontSize: 20,
    color: colors.white,
    fontWeight: typography.bold,
  },

  // Progress
  progressContainer: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 20,
    marginTop: 8,
  },
  stepText: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },

  // Header
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },

  // Input
  inputSection: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: spacing.radiusMd,
    height: spacing.inputHeight,
    paddingHorizontal: 14,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  flag: {
    fontSize: 18,
    marginRight: 6,
  },
  codeText: {
    fontSize: typography.base,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  divider: {
    fontSize: typography.lg,
    color: colors.textMuted,
    marginLeft: 10,
    opacity: 0.3,
  },
  phoneInput: {
    flex: 1,
    fontSize: typography.md,
    color: colors.textPrimary,
    paddingVertical: 0,
    letterSpacing: 1,
  },
  validBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validCheck: {
    fontSize: 14,
    fontWeight: typography.bold,
  },
  inputHint: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 8,
  },

  // Trust signals
  trustSection: {
    paddingHorizontal: spacing.screenPadding,
  },
  trustCard: {
    backgroundColor: colors.bgCard,
    borderRadius: spacing.radiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  trustIcon: {
    fontSize: 18,
    marginRight: 14,
    marginTop: 2,
  },
  trustTextContainer: {
    flex: 1,
  },
  trustTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  trustDesc: {
    fontSize: typography.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  trustDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 32,
  },

  // Bottom
  bottomSection: {
    marginTop: 'auto',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  sendButton: {
    height: spacing.buttonHeight,
    borderRadius: spacing.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sendButtonDisabled: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButtonText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.white,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: typography.base,
    fontWeight: typography.bold,
  },
});