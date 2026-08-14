import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';

export default function OTPScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { accountType, phoneNumber } = route.params;
  const isClient = accountType === 'client';
  const accent = isClient ? colors.client : colors.primary;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(45);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;
  const boxesOpacity = useRef(new Animated.Value(0)).current;
  const boxesScale = useRef(new Animated.Value(0.9)).current;
  const infoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(boxesOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(boxesScale, { toValue: 1, damping: 15, stiffness: 100, useNativeDriver: true }),
      ]),
      Animated.timing(infoOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ];
    Animated.stagger(200, animations).start();

    // Auto-focus first input
    setTimeout(() => inputRefs.current[0]?.focus(), 500);
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Handle OTP digit input
  const handleChange = (text: string, index: number) => {
    // Only allow single digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (digit && index === 5) {
      const fullOtp = [...newOtp.slice(0, 5), digit].join('');
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  // Handle backspace
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  // Verify OTP
  const handleVerify = async (_code: string) => {
    setLoading(true);

    // TODO: Replace with actual Termii verify API call
    // For now simulate verification
    setTimeout(() => {
      setLoading(false);

      // Navigate to appropriate registration step
      if (isClient) {
        navigation.navigate('ClientRegStep1', { phoneNumber });
      } else {
        navigation.navigate('WorkerRegStep1', { phoneNumber });
      }
    }, 1500);
  };

  // Resend OTP
  const handleResend = () => {
    if (!canResend) return;
    setCountdown(45);
    setCanResend(false);
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
    // TODO: Call Termii API to resend
    Alert.alert('Code Sent', 'A new verification code has been sent to your phone');
  };

  // Mask phone number for display: +234 805 **** 733
  const maskedPhone = () => {
    if (phoneNumber.length < 10) return phoneNumber;
    const last3 = phoneNumber.slice(-3);
    const first7 = phoneNumber.slice(0, 7);
    return `${first7} **** ${last3}`;
  };

  const isComplete = otp.every(d => d !== '');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <Text style={[styles.stepText, { color: accent }]}>
          Verifying phone
        </Text>
        <View style={styles.progressTrack}>
          <View style={[
            styles.progressFill,
            { width: isClient ? '33%' : '25%', backgroundColor: accent },
          ]} />
        </View>
      </View>

      {/* Header */}
      <Animated.View style={[styles.headerSection, {
        opacity: headerOpacity,
        transform: [{ translateY: headerSlide }],
      }]}>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to
        </Text>
        <Text style={[styles.phoneDisplay, { color: accent }]}>
          {maskedPhone()}
        </Text>
      </Animated.View>

      {/* OTP Input Boxes */}
      <Animated.View style={[styles.otpContainer, {
        opacity: boxesOpacity,
        transform: [{ scale: boxesScale }],
      }]}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => { inputRefs.current[index] = ref; }}
            style={[
              styles.otpBox,
              digit ? [styles.otpBoxFilled, { borderColor: accent + '60' }] : {},
              index === otp.findIndex(d => d === '') && styles.otpBoxActive,
            ]}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </Animated.View>

      {/* Countdown and resend */}
      <Animated.View style={[styles.resendSection, { opacity: infoOpacity }]}>
        {canResend ? (
          <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
            <Text style={[styles.resendActive, { color: accent }]}>
              Resend code
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.resendText}>
            Resend code in {countdown}s
          </Text>
        )}
      </Animated.View>

      {/* Help text */}
      <Animated.View style={[styles.helpSection, { opacity: infoOpacity }]}>
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Didn't receive the code?</Text>
          <View style={styles.helpRow}>
            <Text style={styles.helpBullet}>•</Text>
            <Text style={styles.helpText}>Check your SMS inbox</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpBullet}>•</Text>
            <Text style={styles.helpText}>Make sure your phone has network</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpBullet}>•</Text>
            <Text style={styles.helpText}>Wait {countdown > 0 ? `${countdown}s` : ''} then tap Resend</Text>
          </View>
        </View>
      </Animated.View>

      {/* Bottom */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.verifyButton,
            { backgroundColor: isComplete ? accent : colors.bgCard },
            !isComplete && styles.verifyButtonDisabled,
          ]}
          onPress={() => handleVerify(otp.join(''))}
          disabled={!isComplete || loading}
          activeOpacity={0.85}
        >
          <Text style={styles.verifyText}>
            {loading ? 'Verifying...' : 'Verify Phone Number'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.changeRow}
        >
          <Text style={styles.changeText}>
            Wrong number? <Text style={{ color: accent, fontWeight: typography.bold }}>Change it</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Back
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
  headerSection: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 32,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  phoneDisplay: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    marginTop: 4,
  },

  // OTP boxes
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 24,
  },
  otpBox: {
    width: 50,
    height: 56,
    borderRadius: spacing.radiusMd,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgInput,
    textAlign: 'center',
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  otpBoxFilled: {
    backgroundColor: colors.bgCard,
  },
  otpBoxActive: {
    borderColor: colors.textMuted,
  },

  // Resend
  resendSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  resendActive: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },

  // Help
  helpSection: {
    paddingHorizontal: spacing.screenPadding,
  },
  helpCard: {
    backgroundColor: colors.bgCard,
    borderRadius: spacing.radiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  helpTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  helpBullet: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginRight: 8,
    width: 12,
  },
  helpText: {
    fontSize: typography.xs,
    color: colors.textMuted,
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
  verifyButton: {
    height: spacing.buttonHeight,
    borderRadius: spacing.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  verifyText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.white,
  },
  changeRow: {
    alignItems: 'center',
  },
  changeText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
});