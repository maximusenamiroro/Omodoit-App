import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  Animated, StatusBar, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASING, colors, typography, spacing, useEntrance } from '../../theme';
import Icon from '../../components/common/Icon';
import PressableScale from '../../components/common/PressableScale';

const SERVICE_AREAS = ['Within 3km', 'Within 5km', 'Within 10km', 'Within 20km', 'State-wide', 'Nationwide'];

export default function WorkerRegStep3Screen({ navigation, route }: any) {
  const entrance = useEntrance();
  const insets = useSafeAreaInsets();
  const params = route.params;

  const [location, setLocation] = useState('');
  const [serviceArea, setServiceArea] = useState<string | null>(null);
  const [focused, setFocused] = useState('');

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;
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
      Animated.timing(buttonOpacity, { toValue: 1, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
    ]).start();
  }, [buttonOpacity, formOpacity, formSlide, headerOpacity, headerSlide]);

  const isFormValid = () => {
    return location.trim().length >= 2 && serviceArea !== null;
  };

  const handleContinue = () => {
    if (!isFormValid()) {
      Alert.alert('Complete All Fields', 'Please enter your location and select your service area');
      return;
    }

    navigation.navigate('WorkerRegStep4', {
      ...params,
      location: location.trim(),
      serviceArea,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <PressableScale
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="back" size={20} color={colors.white} />
      </PressableScale>

      <View style={styles.progressContainer}>
        <Text style={styles.stepText}>Step 3 of 4</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '75%' }]} />
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
          <Text style={styles.title}>Where do you work?</Text>
          <Text style={styles.subtitle}>
            Set your location and service area so nearby clients can discover you
          </Text>
        </Animated.View>

        <Animated.View style={{
          opacity: formOpacity,
          transform: [{ translateY: formSlide }],
        }}>
          {/* Location */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Your Location *</Text>
            <TextInput
              style={[
                styles.input,
                focused === 'location' && styles.inputFocused,
              ]}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Ikeja, Lagos"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              onFocus={() => setFocused('location')}
              onBlur={() => setFocused('')}
            />
            <Text style={styles.fieldHint}>City and state where you are based</Text>
          </View>

          {/* Service Area */}
          <Text style={styles.fieldLabel}>How far will you travel? *</Text>
          <Text style={styles.fieldHintTop}>Clients within this range can find and book you</Text>

          <View style={styles.areaGrid}>
            {SERVICE_AREAS.map((area, i) => (
              <PressableScale
                key={i}
                style={[
                  styles.areaChip,
                  serviceArea === area && styles.areaChipSelected,
                ]}
                onPress={() => setServiceArea(area)}
              >
                {serviceArea === area && <Text style={styles.areaCheck}>✓ </Text>}
                <Text style={[
                  styles.areaText,
                  serviceArea === area && styles.areaTextSelected,
                ]}>{area}</Text>
              </PressableScale>
            ))}
          </View>

          {/* Privacy note */}
          <View style={styles.privacyCard}>
            <Text style={styles.privacyIcon}>📍</Text>
            <View style={styles.privacyInfo}>
              <Text style={styles.privacyTitle}>Your exact location stays private</Text>
              <Text style={styles.privacyDesc}>
                Only your city/area is shown to clients. Your precise GPS is only shared during active tracking after you accept a booking.
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={{ opacity: buttonOpacity }}>
          <PressableScale
            style={[
              styles.continueButton,
              !isFormValid() && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!isFormValid()}
          >
            <Text style={styles.continueText}>Continue</Text>
          </PressableScale>
        </Animated.View>
      </View>
    </View>
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
  subtitle: { fontSize: typography.base, color: colors.textSecondary, lineHeight: 22, marginBottom: 24 },

  fieldContainer: { marginBottom: 24 },
  fieldLabel: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textPrimary, marginBottom: 8 },
  fieldHint: { fontSize: typography.xs, color: colors.textMuted, marginTop: 6 },
  fieldHintTop: { fontSize: typography.xs, color: colors.textMuted, marginBottom: 12, marginTop: -4 },
  input: {
    height: spacing.inputHeight, backgroundColor: colors.bgInput,
    borderRadius: spacing.radiusMd, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 16, fontSize: typography.base, color: colors.textPrimary,
  },
  inputFocused: { borderColor: colors.primary + '50' },

  areaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24,
  },
  areaChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: spacing.radiusMd, backgroundColor: colors.bgCard,
    borderWidth: 1.5, borderColor: colors.border,
    width: '48%',
  },
  areaChipSelected: {
    borderColor: colors.primary + '60', backgroundColor: colors.primary + '10',
  },
  areaCheck: { fontSize: 12, color: colors.primary, fontWeight: typography.bold },
  areaText: { fontSize: typography.sm, color: colors.textSecondary },
  areaTextSelected: { color: colors.primary, fontWeight: typography.semibold },

  privacyCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  privacyIcon: { fontSize: 18, marginRight: 12, marginTop: 2 },
  privacyInfo: { flex: 1 },
  privacyTitle: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textPrimary, marginBottom: 4 },
  privacyDesc: { fontSize: typography.xs, color: colors.textMuted, lineHeight: 16 },

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