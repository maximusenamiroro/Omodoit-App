import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Animated, StatusBar, Platform, Alert,
  KeyboardAvoidingView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { CATEGORIES as CATEGORY_LIST } from '../../lib/categories';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { generateBatchId } from '../../lib/db';


// Derived from the shared taxonomy so this always matches exactly what
// workers can register under and what shows up when browsing — this
// used to be a separate hand-maintained copy that had drifted (missing
// 3 categories, and subcategories that didn't match worker registration).
const CATEGORIES: Record<string, string[]> = Object.fromEntries(
  CATEGORY_LIST.map(c => [c.name, c.subs])
);
const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  CATEGORY_LIST.map(c => [c.name, c.emoji])
);

export default function FlashJobScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [budgetType, setBudgetType] = useState('Fixed Price');
  const [fixedBudget, setFixedBudget] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [note, setNote] = useState('');
  const [focused, setFocused] = useState('');
  const [catExpanded, setCatExpanded] = useState('');

  // Typed, otherwise useRef(null) infers `never` and every
  // scrollRef.current?.scrollTo(...) below is a type error.
  const scrollRef = useRef<ScrollView>(null);
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(formSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
    ]).start();
  }, [step]);

  const goNext = () => {
    if (!category || !subcategory) {
      Alert.alert('Select Service', 'Please choose a category and subcategory');
      return;
    }
    setStep(2);
    formOpacity.setValue(0);
    formSlide.setValue(30);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  };

  const goBack = () => {
    setStep(1);
    formOpacity.setValue(0);
    formSlide.setValue(30);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  };

  const submitFlash = async () => {
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please enter your location');
      return;
    }
    if (budgetType === 'Fixed Price' && !fixedBudget) {
      Alert.alert('Budget Required', 'Please enter your budget');
      return;
    }
    if (!user?.id) {
      Alert.alert('Please Log In', 'You need to be logged in to send a Flash Job.');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      // Find matching workers to broadcast to. There's no dedicated
      // flash-job table yet (would need a schema migration), so this
      // broadcasts by inserting one hire_requests row per matching
      // worker - functionally the same "first to accept wins" idea,
      // just without a shared batch ID to auto-cancel the others once
      // someone accepts. That refinement needs an extra column on
      // hire_requests to track later.
      let { data: matchingWorkers, error: matchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'worker')
        .eq('category', category)
        .eq('subcategory', subcategory)
        .limit(20);

      if (matchError) throw matchError;

      // No exact subcategory match — broaden to anyone in the same
      // general category rather than failing outright. Reaching some
      // relevant workers is better than reaching none over a narrow
      // mismatch (e.g. the client picked a slightly different
      // specialty within the same trade than any worker has listed).
      let broadenedMatch = false;
      if (!matchingWorkers || matchingWorkers.length === 0) {
        const { data: categoryWorkers, error: categoryError } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'worker')
          .eq('category', category)
          .limit(20);

        if (categoryError) throw categoryError;
        if (categoryWorkers && categoryWorkers.length > 0) {
          matchingWorkers = categoryWorkers;
          broadenedMatch = true;
        }
      }

      if (!matchingWorkers || matchingWorkers.length === 0) {
        Alert.alert(
          'No Workers Available',
          `There are no ${category} workers on Omodoit yet. Try Browse Workers instead, or check back soon.`
        );
        setSubmitting(false);
        return;
      }

      let description = `⚡ Flash Job: ${subcategory}`;
      if (landmark.trim()) description += `\nNear: ${landmark.trim()}`;
      if (budgetType === 'Fixed Price' && fixedBudget) description += `\nBudget: ₦${fixedBudget}`;
      if (budgetType === 'Range' && (minBudget || maxBudget)) description += `\nBudget: ₦${minBudget || '?'} - ₦${maxBudget || '?'}`;
      if (budgetType === 'Negotiable') description += '\nBudget: Negotiable';
      if (note.trim()) description += `\n\n${note.trim()}`;

      const batchId = generateBatchId();
      const rows = matchingWorkers.map((w: any) => ({
        client_id: user.id,
        worker_id: w.id,
        job_description: description,
        location: address.trim(),
        status: 'pending',
        flash_batch_id: batchId,
      }));

      const { error: insertError } = await supabase.from('hire_requests').insert(rows);
      if (insertError) throw insertError;

      Alert.alert(
        '⚡ Flash Job Sent!',
        broadenedMatch
          ? `No exact ${subcategory} match, so your request went to ${matchingWorkers.length} nearby ${category} worker${matchingWorkers.length === 1 ? '' : 's'} instead. The first to accept wins!`
          : `Your request has been flashed to ${matchingWorkers.length} nearby ${subcategory} worker${matchingWorkers.length === 1 ? '' : 's'}. The first to accept wins!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      console.error('Flash job submission error:', err);
      Alert.alert('Could Not Send Flash Job', 'Something went wrong. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <KeyboardAvoidingView
      style={[st.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <Animated.View style={[st.header, { opacity: headerOpacity }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => step === 1 ? navigation.goBack() : goBack()} activeOpacity={0.7}>
          <Text style={st.backText}>←</Text>
        </TouchableOpacity>
        <View style={st.headerCenter}>
          <View style={st.flashBadge}>
            <Text style={st.flashBadgeIcon}>⚡</Text>
          </View>
          <View>
            <Text style={st.headerTitle}>Flash Job</Text>
            <Text style={st.headerSub}>{step === 1 ? 'Choose Service' : 'Location & Budget'}</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      {/* Progress */}
      <View style={st.progressRow}>
        <View style={st.progressStep}>
          <View style={[st.progressDot, st.progressDotActive]}>
            {step > 1 ? <Text style={st.progressCheck}>✓</Text> : <Text style={st.progressNum}>1</Text>}
          </View>
          <Text style={[st.progressLabel, st.progressLabelActive]}>Service</Text>
        </View>
        <View style={st.progressLine}>
          <View style={[st.progressLineFill, step > 1 && st.progressLineFillActive]} />
        </View>
        <View style={st.progressStep}>
          <View style={[st.progressDot, step >= 2 && st.progressDotActive]}>
            <Text style={[st.progressNum, step >= 2 && { color: '#fff' }]}>2</Text>
          </View>
          <Text style={[st.progressLabel, step >= 2 && st.progressLabelActive]}>Details</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 140 : 120 }}>

        <Animated.View style={{ opacity: formOpacity, transform: [{ translateY: formSlide }], paddingHorizontal: spacing.screenPadding }}>

          {/* STEP 1 — Category & Subcategory */}
          {step === 1 && (
            <View>
              <Text style={st.sectionTitle}>What service do you need?</Text>
              <Text style={st.sectionDesc}>Pick a category and we'll flash the right pros nearby.</Text>

              {/* Selected preview */}
              <View style={st.previewCard}>
                <View style={[st.previewIcon, category ? st.previewIconActive : {}]}>
                  <Text style={st.previewEmoji}>{category ? (CATEGORY_ICONS[category] || '📦') : '🏠'}</Text>
                </View>
                <Text style={st.previewText}>
                  {subcategory || (category ? 'Choose a subcategory' : 'Select a category to begin')}
                </Text>
                {category && <Text style={st.previewSub}>{category}</Text>}
              </View>

              {/* Category list */}
              {Object.keys(CATEGORIES).map(cat => {
                const isSelected = category === cat;
                const isExpanded = catExpanded === cat;
                return (
                  <View key={cat}>
                    <TouchableOpacity
                      style={[st.catRow, isSelected && st.catRowSelected]}
                      onPress={() => {
                        setCategory(cat);
                        setCatExpanded(isExpanded ? '' : cat);
                        if (category !== cat) setSubcategory('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={st.catEmoji}>{CATEGORY_ICONS[cat] || '📦'}</Text>
                      <Text style={[st.catName, isSelected && st.catNameSelected]}>{cat}</Text>
                      <Text style={st.catArrow}>{isExpanded ? '⌃' : '⌄'}</Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={st.subsGrid}>
                        {(CATEGORIES[cat] || []).map(sub => (
                          <TouchableOpacity
                            key={sub}
                            style={[st.subChip, subcategory === sub && st.subChipActive]}
                            onPress={() => setSubcategory(sub)}
                            activeOpacity={0.85}
                          >
                            <Text style={[st.subChipText, subcategory === sub && st.subChipTextActive]}>{sub}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}

              {category && subcategory ? (
                <View style={st.confirmBanner}>
                  <Text style={st.confirmIcon}>✅</Text>
                  <Text style={st.confirmText}>We'll flash this to nearby {subcategory} pros the moment you submit.</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* STEP 2 — Location, Budget, Note */}
          {step === 2 && (
            <View>
              <Text style={st.sectionTitle}>Where, how much & anything to add?</Text>
              <Text style={st.sectionDesc}>Last step — then we blast this to 15 nearby workers.</Text>

              {/* Location */}
              <View style={st.fieldCard}>
                <Text style={st.fieldCardTitle}>📍 Location</Text>
                <Text style={st.fieldLabel}>Address *</Text>
                <TextInput
                  style={[st.input, focused === 'addr' && st.inputFocused]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Street, area, city, state..."
                  placeholderTextColor={colors.textMuted}
                  onFocus={() => setFocused('addr')}
                  onBlur={() => setFocused('')}
                />
                <Text style={st.fieldLabel}>Nearby Landmark (optional)</Text>
                <TextInput
                  style={[st.input, focused === 'land' && st.inputFocused]}
                  value={landmark}
                  onChangeText={setLandmark}
                  placeholder="e.g. Opposite Access Bank"
                  placeholderTextColor={colors.textMuted}
                  onFocus={() => setFocused('land')}
                  onBlur={() => setFocused('')}
                />
              </View>

              {/* Budget */}
              <View style={st.fieldCard}>
                <Text style={st.fieldCardTitle}>💰 Budget</Text>
                <View style={st.budgetTypes}>
                  {['Fixed Price', 'Price Range', 'Negotiable'].map(bt => (
                    <TouchableOpacity
                      key={bt}
                      style={[st.budgetChip, budgetType === bt && st.budgetChipActive]}
                      onPress={() => setBudgetType(bt)}
                      activeOpacity={0.85}
                    >
                      <Text style={[st.budgetChipText, budgetType === bt && st.budgetChipTextActive]}>{bt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {budgetType === 'Fixed Price' && (
                  <View style={[st.budgetInputRow, focused === 'fixed' && st.inputFocused]}>
                    <Text style={st.nairaSign}>₦</Text>
                    <TextInput
                      style={st.budgetInput}
                      value={fixedBudget}
                      onChangeText={setFixedBudget}
                      placeholder="Amount"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      onFocus={() => setFocused('fixed')}
                      onBlur={() => setFocused('')}
                    />
                  </View>
                )}

                {budgetType === 'Price Range' && (
                  <View style={st.rangeRow}>
                    <View style={[st.budgetInputRow, { flex: 1 }, focused === 'min' && st.inputFocused]}>
                      <Text style={st.nairaSign}>₦</Text>
                      <TextInput
                        style={st.budgetInput}
                        value={minBudget}
                        onChangeText={setMinBudget}
                        placeholder="Min"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        onFocus={() => setFocused('min')}
                        onBlur={() => setFocused('')}
                      />
                    </View>
                    <Text style={st.rangeDash}>—</Text>
                    <View style={[st.budgetInputRow, { flex: 1 }, focused === 'max' && st.inputFocused]}>
                      <Text style={st.nairaSign}>₦</Text>
                      <TextInput
                        style={st.budgetInput}
                        value={maxBudget}
                        onChangeText={setMaxBudget}
                        placeholder="Max"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        onFocus={() => setFocused('max')}
                        onBlur={() => setFocused('')}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Note */}
              <View style={st.fieldCard}>
                <Text style={st.fieldCardTitle}>📝 Note (optional)</Text>
                <TextInput
                  style={[st.textArea, focused === 'note' && st.inputFocused]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Anything the worker should know? e.g. The gate is blue..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={500}
                  onFocus={() => setFocused('note')}
                  onBlur={() => setFocused('')}
                />
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom button */}
      <View style={[st.bottomBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16 }]}>
        {step === 2 && (
          <TouchableOpacity style={st.backStepBtn} onPress={goBack} activeOpacity={0.85}>
            <Text style={st.backStepText}>← Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[st.nextBtn, step === 2 && { flex: 1 }, submitting && { opacity: 0.6 }]}
          onPress={step === 1 ? goNext : submitFlash}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {step === 1 ? (
            <Text style={st.nextBtnText}>Next →</Text>
          ) : (
            <View style={st.flashBtnContent}>
              <Text style={st.flashBtnIcon}>⚡</Text>
              <Text style={st.nextBtnText}>{submitting ? 'Sending…' : 'Flash Job'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flashBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFC107', alignItems: 'center', justifyContent: 'center' },
  flashBadgeIcon: { fontSize: 16 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontSize: 10, fontWeight: '600', color: colors.primary },

  progressRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPadding + 20, paddingVertical: 16 },
  progressStep: { alignItems: 'center', gap: 6 },
  progressDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgCard },
  progressDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  progressNum: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  progressCheck: { fontSize: 14, fontWeight: '700', color: '#fff' },
  progressLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  progressLabelActive: { color: colors.primary },
  progressLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 8, marginBottom: 20, borderRadius: 1, overflow: 'hidden' },
  progressLineFill: { height: '100%', width: '0%', backgroundColor: colors.primary },
  progressLineFillActive: { width: '100%' },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 4, marginTop: 4 },
  sectionDesc: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },

  previewCard: { alignItems: 'center', paddingVertical: 20, marginBottom: 16 },
  previewIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  previewIconActive: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  previewEmoji: { fontSize: 30 },
  previewText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  previewSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, marginBottom: 6, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  catRowSelected: { borderColor: colors.primary + '40', backgroundColor: colors.primary + '08' },
  catEmoji: { fontSize: 20, marginRight: 12 },
  catName: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  catNameSelected: { fontWeight: '700', color: colors.primary },
  catArrow: { fontSize: 14, color: colors.textMuted },

  subsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 8, paddingVertical: 10, marginBottom: 6 },
  subChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  subChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  subChipText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  subChipTextActive: { color: '#fff', fontWeight: '700' },

  confirmBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '10', borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '30', padding: 14, marginTop: 12, gap: 10 },
  confirmIcon: { fontSize: 16 },
  confirmText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.primary },

  fieldCard: { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 },
  fieldCardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 8 },
  input: { height: 48, backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, fontSize: 14, color: colors.textPrimary },
  inputFocused: { borderColor: colors.primary + '50' },
  textArea: { backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontSize: 14, color: colors.textPrimary, minHeight: 80 },

  budgetTypes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  budgetChip: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.bgCard },
  budgetChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  budgetChipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  budgetChipTextActive: { color: '#fff' },

  budgetInputRow: { flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, marginTop: 4 },
  nairaSign: { fontSize: 16, fontWeight: '700', color: colors.primary, marginRight: 8 },
  budgetInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  rangeDash: { fontSize: 14, color: colors.textMuted },

  bottomBar: { flexDirection: 'row', paddingHorizontal: spacing.screenPadding, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, gap: 10 },
  backStepBtn: { paddingHorizontal: 20, height: 50, borderRadius: 16, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  backStepText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  nextBtn: { flex: 1, height: 50, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  nextBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  flashBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flashBtnIcon: { fontSize: 16, color: '#FFC107' },
});
