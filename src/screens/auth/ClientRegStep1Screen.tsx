import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  Animated, KeyboardAvoidingView, Platform, StatusBar,
  ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASING, colors, typography, spacing } from '../../theme';
import PressableScale from '../../components/common/PressableScale';

export default function ClientRegStep1Screen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');

  // Track which field is focused for border highlight
  const [focused, setFocused] = useState('');

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;
  const verifiedOpacity = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, easing: EASING.OUT, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 400, easing: EASING.OUT, useNativeDriver: true }),
      ]),
      Animated.timing(verifiedOpacity, { toValue: 1, duration: 300, easing: EASING.OUT, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 300, easing: EASING.OUT, useNativeDriver: true }),
        Animated.spring(formSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 300, easing: EASING.OUT, useNativeDriver: true }),
    ]).start();
  }, [buttonOpacity, formOpacity, formSlide, headerOpacity, headerSlide, verifiedOpacity]);

  // Validation
  const isValidEmail = (e: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  };

  const isFormValid = () => {
    return fullName.trim().length >= 2 && isValidEmail(email) && location.trim().length >= 2;
  };

  const handleContinue = () => {
    if (!isFormValid()) {
      if (fullName.trim().length < 2) {
        Alert.alert('Name Required', 'Please enter your full name');
      } else if (!isValidEmail(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
      } else if (location.trim().length < 2) {
        Alert.alert('Location Required', 'Please enter your location');
      }
      return;
    }

    navigation.navigate('ClientRegStep3', {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      location: location.trim(),
    });
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
        <Text style={styles.backText}>←</Text>
      </PressableScale>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <Text style={[styles.stepText, { color: colors.client }]}>Step 2 of 3</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '66%', backgroundColor: colors.client }]} />
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
          <Text style={styles.title}>Tell us about yourself</Text>
          <Text style={styles.subtitle}>
            This information helps workers and clients connect with you
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View style={{
          opacity: formOpacity,
          transform: [{ translateY: formSlide }],
        }}>
          {/* Full Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              style={[
                styles.input,
                focused === 'name' && styles.inputFocused,
                fullName.length > 0 && styles.inputFilled,
              ]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full legal name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused('')}
            />
            <Text style={styles.fieldHint}>
              This appears on your profile
            </Text>
          </View>

          {/* Email */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Email Address *</Text>
            <TextInput
              style={[
                styles.input,
                focused === 'email' && styles.inputFocused,
                email.length > 0 && isValidEmail(email) && styles.inputValid,
                email.length > 0 && !isValidEmail(email) && styles.inputError,
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="your.email@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused('')}
            />
            {email.length > 0 && !isValidEmail(email) && (
              <Text style={styles.errorHint}>Please enter a valid email</Text>
            )}
            {email.length > 0 && isValidEmail(email) && (
              <Text style={styles.successHint}>✓ Valid email</Text>
            )}
            <Text style={styles.fieldHint}>
              Used for booking receipts and password reset
            </Text>
          </View>

          {/* Location */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Your Location *</Text>
            <TextInput
              style={[
                styles.input,
                focused === 'location' && styles.inputFocused,
                location.length > 0 && styles.inputFilled,
              ]}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Ikeja, Lagos"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              onFocus={() => setFocused('location')}
              onBlur={() => setFocused('')}
            />
            <Text style={styles.fieldHint}>
              Helps us show workers near you
            </Text>
          </View>

          {/* Privacy note */}
          <View style={styles.privacyCard}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <View style={styles.privacyTextContainer}>
              <Text style={styles.privacyTitle}>Your data is protected</Text>
              <Text style={styles.privacyDesc}>
                We never sell or share your personal information. Read our Privacy Policy for details.
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={{ opacity: buttonOpacity }}>
          <PressableScale
            style={[
              styles.continueButton,
              { backgroundColor: isFormValid() ? colors.client : colors.bgCard },
              !isFormValid() && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!isFormValid()}
          >
            <Text style={styles.continueText}>Continue</Text>
          </PressableScale>
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

  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary + '15',
    borderRadius: spacing.radiusMd, borderWidth: 1,
    borderColor: colors.primary + '30',
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 24,
  },
  verifiedIcon: {
    fontSize: 14, color: colors.primary, fontWeight: typography.bold, marginRight: 8,
  },
  verifiedText: {
    fontSize: typography.sm, color: colors.primary, fontWeight: typography.medium,
  },

  fieldContainer: { marginBottom: 20 },
  fieldLabel: {
    fontSize: typography.sm, fontWeight: typography.medium,
    color: colors.textSecondary, marginBottom: 8,
  },
  input: {
    height: spacing.inputHeight, backgroundColor: colors.bgInput,
    borderRadius: spacing.radiusMd, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: 16,
    fontSize: typography.base, color: colors.textPrimary,
  },
  inputFocused: { borderColor: colors.client + '50' },
  inputFilled: { borderColor: colors.border },
  inputValid: { borderColor: colors.primary + '50' },
  inputError: { borderColor: colors.error + '50' },
  fieldHint: { fontSize: typography.xs, color: colors.textMuted, marginTop: 6 },
  errorHint: { fontSize: typography.xs, color: colors.error, marginTop: 6 },
  successHint: { fontSize: typography.xs, color: colors.primary, marginTop: 6 },

  privacyCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, marginTop: 8,
  },
  privacyIcon: { fontSize: 18, marginRight: 12, marginTop: 2 },
  privacyTextContainer: { flex: 1 },
  privacyTitle: {
    fontSize: typography.sm, fontWeight: typography.semibold,
    color: colors.textPrimary, marginBottom: 4,
  },
  privacyDesc: { fontSize: typography.xs, color: colors.textMuted, lineHeight: 16 },

  bottomSection: {
    paddingHorizontal: spacing.screenPadding, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  continueButton: {
    height: spacing.buttonHeight, borderRadius: spacing.radiusLg,
    alignItems: 'center', justifyContent: 'center',
  },
  continueButtonDisabled: { borderWidth: 1, borderColor: colors.border },
  continueText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.white },
});