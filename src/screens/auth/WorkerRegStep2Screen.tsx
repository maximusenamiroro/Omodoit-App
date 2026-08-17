import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, StatusBar, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import { CATEGORIES } from '../../lib/categories';

const EXPERIENCE = ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', '10+ years'];

export default function WorkerRegStep2Screen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { fullName, email, businessName } = route.params;

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<string | null>(null);

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;
  const catsOpacity = useRef(new Animated.Value(0)).current;
  const catsSlide = useRef(new Animated.Value(30)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(catsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(catsSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [buttonOpacity, catsOpacity, catsSlide, headerOpacity, headerSlide]);

  const isFormValid = () => {
    return selectedCategory !== null && selectedSub !== null && selectedExperience !== null;
  };

  const handleContinue = () => {
    if (!isFormValid()) {
      Alert.alert('Complete All Fields', 'Please select your category, subcategory, and experience level');
      return;
    }

    navigation.navigate('WorkerRegStep3', {
      fullName,
      email,
      businessName,
      category: CATEGORIES[selectedCategory!].name,
      subcategory: selectedSub,
      experience: selectedExperience,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <PressableScale
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>←</Text>
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
      >
        <Animated.View style={{
          opacity: headerOpacity,
          transform: [{ translateY: headerSlide }],
        }}>
          <Text style={styles.title}>What do you do?</Text>
          <Text style={styles.subtitle}>
            Choose your category and skill. This is how clients find you.
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              This determines who discovers you. Choose carefully — you can change it later in settings.
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={{
          opacity: catsOpacity,
          transform: [{ translateY: catsSlide }],
        }}>
          {/* Main Category */}
          <Text style={styles.sectionLabel}>Main Category *</Text>

          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat, i) => (
              <PressableScale
                key={i}
                style={[
                  styles.categoryCard,
                  selectedCategory === i && styles.categoryCardSelected,
                ]}
                onPress={() => {
                  setSelectedCategory(i);
                  setSelectedSub(null);
                }}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[
                  styles.categoryName,
                  selectedCategory === i && styles.categoryNameSelected,
                ]} numberOfLines={2}>
                  {cat.name}
                </Text>
                {selectedCategory === i && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </PressableScale>
            ))}
          </View>

          {/* Subcategory — only show after category selected */}
          {selectedCategory !== null && (
            <>
              <Text style={styles.sectionLabel}>Your Specific Skill *</Text>
              <View style={styles.subsGrid}>
                {CATEGORIES[selectedCategory].subs.map((sub, i) => (
                  <PressableScale
                    key={i}
                    style={[
                      styles.subChip,
                      selectedSub === sub && styles.subChipSelected,
                    ]}
                    onPress={() => setSelectedSub(sub)}
                  >
                    {selectedSub === sub && <Text style={styles.subCheck}>✓ </Text>}
                    <Text style={[
                      styles.subText,
                      selectedSub === sub && styles.subTextSelected,
                    ]}>{sub}</Text>
                  </PressableScale>
                ))}
              </View>
            </>
          )}

          {/* Experience */}
          {selectedSub !== null && (
            <>
              <Text style={styles.sectionLabel}>Years of Experience *</Text>
              <View style={styles.expGrid}>
                {EXPERIENCE.map((exp, i) => (
                  <PressableScale
                    key={i}
                    style={[
                      styles.expChip,
                      selectedExperience === exp && styles.expChipSelected,
                    ]}
                    onPress={() => setSelectedExperience(exp)}
                  >
                    {selectedExperience === exp && <Text style={styles.expCheck}>✓ </Text>}
                    <Text style={[
                      styles.expText,
                      selectedExperience === exp && styles.expTextSelected,
                    ]}>{exp}</Text>
                  </PressableScale>
                ))}
              </View>
            </>
          )}
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
  subtitle: { fontSize: typography.base, color: colors.textSecondary, lineHeight: 22, marginBottom: 12 },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.primary + '08', borderRadius: spacing.radiusMd,
    borderWidth: 1, borderColor: colors.primary + '20',
    padding: 12, marginBottom: 20,
  },
  infoIcon: { fontSize: 14, marginRight: 10, marginTop: 2 },
  infoText: { flex: 1, fontSize: typography.sm, color: colors.textSecondary, lineHeight: 18 },

  sectionLabel: {
    fontSize: typography.sm, fontWeight: typography.semibold,
    color: colors.textPrimary, marginBottom: 10, marginTop: 4,
  },

  // Category grid
  categoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20,
  },
  categoryCard: {
    width: '48%', backgroundColor: colors.bgCard,
    borderRadius: spacing.radiusMd, borderWidth: 1.5, borderColor: colors.border,
    padding: 12, alignItems: 'center', minHeight: 80, justifyContent: 'center',
  },
  categoryCardSelected: {
    borderColor: colors.primary + '60', backgroundColor: colors.primary + '08',
  },
  categoryEmoji: { fontSize: 24, marginBottom: 6 },
  categoryName: {
    fontSize: typography.xs, fontWeight: typography.medium,
    color: colors.textSecondary, textAlign: 'center',
  },
  categoryNameSelected: { color: colors.primary, fontWeight: typography.semibold },
  checkBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  checkText: { fontSize: 10, color: colors.white, fontWeight: typography.bold },

  // Subcategory chips
  subsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20,
  },
  subChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: spacing.radiusMd, backgroundColor: colors.bgCard,
    borderWidth: 1.5, borderColor: colors.border,
  },
  subChipSelected: {
    borderColor: colors.primary + '60', backgroundColor: colors.primary + '10',
  },
  subCheck: { fontSize: 12, color: colors.primary, fontWeight: typography.bold },
  subText: { fontSize: typography.sm, color: colors.textSecondary },
  subTextSelected: { color: colors.primary, fontWeight: typography.semibold },

  // Experience
  expGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20,
  },
  expChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: spacing.radiusMd, backgroundColor: colors.bgCard,
    borderWidth: 1.5, borderColor: colors.border,
  },
  expChipSelected: {
    borderColor: colors.primary + '60', backgroundColor: colors.primary + '10',
  },
  expCheck: { fontSize: 12, color: colors.primary, fontWeight: typography.bold },
  expText: { fontSize: typography.sm, color: colors.textSecondary },
  expTextSelected: { color: colors.primary, fontWeight: typography.semibold },

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