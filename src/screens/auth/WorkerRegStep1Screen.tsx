import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, KeyboardAvoidingView, Platform, StatusBar,
  ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';

export default function WorkerRegStep1Screen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
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
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(verifiedOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(formSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const isFormValid = () => {
    return fullName.trim().length >= 2 && isValidEmail(email);
  };

  const handleContinue = () => {
    if (!isFormValid()) {
      if (fullName.trim().length < 2) {
        Alert.alert('Name Required', 'Please enter your full name');
      } else if (!isValidEmail(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
      }
      return;
    }

    navigation.navigate('WorkerRegStep2', {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      businessName: businessName.trim() || null,
    });
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

      {/* Progress */}
      <View style={styles.progressContainer}>
        <Text style={styles.stepText}>Step 1 of 4</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '25%' }]} />
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
          <Text style={styles.title}>Your business profile</Text>
          <Text style={styles.subtitle}>
            Tell us about yourself so clients can find and trust you
          </Text>
        </Animated.View>

        {/* Worker type badge */}
        <Animated.View style={[styles.typeBadge, { opacity: verifiedOpacity }]}>
          <Text style={styles.typeDot}>🔨</Text>
          <Text style={styles.typeText}>Worker / Business Account</Text>
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
              ]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full legal name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused('')}
            />
            <Text style={styles.fieldHint}>This appears on your worker profile</Text>
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
            <Text style={styles.fieldHint}>Clients contact you here and for password reset</Text>
          </View>

          {/* Business Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Business / Trade Name <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[
                styles.input,
                focused === 'business' && styles.inputFocused,
              ]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. John's Electrical Services"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              onFocus={() => setFocused('business')}
              onBlur={() => setFocused('')}
            />
            <Text style={styles.fieldHint}>
              Makes your profile look professional — you can add this later
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={{ opacity: buttonOpacity }}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !isFormValid() && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!isFormValid()}
            activeOpacity={0.85}
          >
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
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

  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary + '15',
    borderRadius: spacing.radiusMd, borderWidth: 1, borderColor: colors.primary + '30',
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8,
  },
  verifiedIcon: { fontSize: 14, color: colors.primary, fontWeight: typography.bold, marginRight: 8 },
  verifiedText: { fontSize: typography.sm, color: colors.primary, fontWeight: typography.medium },

  typeBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary + '08',
    borderRadius: spacing.radiusMd, borderWidth: 1, borderColor: colors.primary + '20',
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 24,
  },
  typeDot: { fontSize: 14, marginRight: 8 },
  typeText: { fontSize: typography.sm, color: colors.primary, fontWeight: typography.medium },

  fieldContainer: { marginBottom: 20 },
  fieldLabel: { fontSize: typography.sm, fontWeight: typography.medium, color: colors.textSecondary, marginBottom: 8 },
  optional: { color: colors.textMuted, fontWeight: typography.regular },
  input: {
    height: spacing.inputHeight, backgroundColor: colors.bgInput,
    borderRadius: spacing.radiusMd, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 16, fontSize: typography.base, color: colors.textPrimary,
  },
  inputFocused: { borderColor: colors.primary + '50' },
  inputValid: { borderColor: colors.primary + '50' },
  inputError: { borderColor: colors.error + '50' },
  fieldHint: { fontSize: typography.xs, color: colors.textMuted, marginTop: 6 },
  errorHint: { fontSize: typography.xs, color: colors.error, marginTop: 6 },
  successHint: { fontSize: typography.xs, color: colors.primary, marginTop: 6 },

  bottomSection: {
    paddingHorizontal: spacing.screenPadding, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  continueButton: {
    height: spacing.buttonHeight, borderRadius: spacing.radiusLg,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary,
  },
  continueButtonDisabled: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  continueText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.white },
});
