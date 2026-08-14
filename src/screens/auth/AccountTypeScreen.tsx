import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';


type AccountType = 'client' | 'worker' | null;

export default function AccountTypeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<AccountType>(null);

  // Simple fade+slide animations — one per element
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const clientOpacity = useRef(new Animated.Value(0)).current;
  const clientSlide = useRef(new Animated.Value(40)).current;
  const workerOpacity = useRef(new Animated.Value(0)).current;
  const workerSlide = useRef(new Animated.Value(40)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(20)).current;
  const loginOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance — each element 120ms after the last
    const animations = [
      // Logo
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, damping: 15, stiffness: 120, useNativeDriver: true }),
      ]),
      // Title
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      // Subtitle
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      // Client card
      Animated.parallel([
        Animated.timing(clientOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(clientSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
      // Worker card
      Animated.parallel([
        Animated.timing(workerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(workerSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
      // Button
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(buttonSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      // Login link
      Animated.timing(loginOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ];

    Animated.stagger(120, animations).start();
  }, []);

  const handleContinue = () => {
    if (!selected) return;
    navigation.navigate('PhoneVerify', { accountType: selected });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Logo */}
        <Animated.View style={[
          styles.logoContainer,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}>
          <View style={styles.logoBox}>
            <Text style={styles.logoO}>O</Text>
          </View>
          <Text style={styles.appName}>omodoit</Text>
        </Animated.View>

        {/* Title */}
        <Animated.View style={{
          opacity: titleOpacity,
          transform: [{ translateY: titleSlide }],
        }}>
          <Text style={styles.title}>Join Omodoit</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Text style={styles.subtitle}>Choose how you want to use the app</Text>
        </Animated.View>

        {/* Client Card */}
        <Animated.View style={{
          opacity: clientOpacity,
          transform: [{ translateY: clientSlide }],
        }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelected('client')}
            style={[
              styles.card,
              selected === 'client' && styles.cardSelectedClient,
            ]}
          >
            {/* Top accent strip */}
            <View style={[
              styles.cardStrip,
              { backgroundColor: selected === 'client' ? colors.client : 'transparent' },
            ]} />

            {/* Card header row */}
            <View style={styles.cardHeader}>
              <View style={[
                styles.iconCircle,
                { backgroundColor: selected === 'client' ? colors.client + '20' : colors.bgCard },
              ]}>
                <Text style={styles.iconEmoji}>👤</Text>
              </View>

              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>I'm a Client</Text>
                <Text style={styles.cardDesc}>
                  I need to hire workers and get services done
                </Text>
              </View>

              {/* Radio button */}
              <View style={[
                styles.radio,
                selected === 'client' && { borderColor: colors.client },
              ]}>
                {selected === 'client' && (
                  <View style={[styles.radioDot, { backgroundColor: colors.client }]} />
                )}
              </View>
            </View>

            {/* Features */}
            <View style={styles.features}>
              {['Find verified workers nearby', 'Book instantly or send Flash Job', 'Track workers in real time'].map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={[styles.dot, { backgroundColor: colors.client + '70' }]} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Worker Card */}
        <Animated.View style={{
          opacity: workerOpacity,
          transform: [{ translateY: workerSlide }],
        }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelected('worker')}
            style={[
              styles.card,
              selected === 'worker' && styles.cardSelectedWorker,
            ]}
          >
            <View style={[
              styles.cardStrip,
              { backgroundColor: selected === 'worker' ? colors.primary : 'transparent' },
            ]} />

            <View style={styles.cardHeader}>
              <View style={[
                styles.iconCircle,
                { backgroundColor: selected === 'worker' ? colors.primary + '20' : colors.bgCard },
              ]}>
                <Text style={styles.iconEmoji}>🔨</Text>
              </View>

              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>I'm a Worker / Business</Text>
                <Text style={styles.cardDesc}>
                  I offer services and want to get hired by clients
                </Text>
              </View>

              <View style={[
                styles.radio,
                selected === 'worker' && { borderColor: colors.primary },
              ]}>
                {selected === 'worker' && (
                  <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                )}
              </View>
            </View>

            <View style={styles.features}>
              {[
                'Get discovered by clients near you',
                'Go live and receive bookings',
                'Receive Flash Job alerts instantly',
                'Showcase work through video reels',
              ].map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={[styles.dot, { backgroundColor: colors.primary + '70' }]} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Bottom section — fixed */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        {/* Continue button */}
        <Animated.View style={{
          opacity: buttonOpacity,
          transform: [{ translateY: buttonSlide }],
        }}>
          <TouchableOpacity
            style={[
              styles.continueBtn,
              !selected && styles.continueBtnDisabled,
              selected === 'client' && { backgroundColor: colors.client },
              selected === 'worker' && { backgroundColor: colors.primary },
            ]}
            onPress={handleContinue}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <Text style={styles.continueText}>
              {selected === 'client'
                ? 'Continue as Client'
                : selected === 'worker'
                ? 'Continue as Worker'
                : 'Select an account type'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Login link */}
        <Animated.View style={[styles.loginRow, { opacity: loginOpacity }]}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
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

  // Logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoO: {
    fontSize: 28,
    fontWeight: typography.bold,
    color: colors.white,
  },
  appName: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
    letterSpacing: -0.5,
  },

  // Title
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Cards
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: spacing.radiusXl,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardSelectedClient: {
    borderColor: colors.client + '60',
    backgroundColor: colors.client + '08',
  },
  cardSelectedWorker: {
    borderColor: colors.primary + '60',
    backgroundColor: colors.primary + '08',
  },
  cardStrip: {
    height: 4,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: spacing.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconEmoji: {
    fontSize: 22,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Features
  features: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingLeft: 78,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 8,
  },
  featureText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },

  // Bottom
  bottomSection: {
    paddingHorizontal: spacing.screenPadding,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  continueBtn: {
    height: spacing.buttonHeight,
    borderRadius: spacing.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textMuted,
    marginBottom: 16,
  },
  continueBtnDisabled: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  continueText: {
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
    color: colors.primary,
  },
});