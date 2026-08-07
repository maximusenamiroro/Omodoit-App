import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Animated, StatusBar, Platform, Alert,
  KeyboardAvoidingView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');

const CATEGORIES = {
  'Handwork & Skilled Workers': ['Carpenter', 'Plumber', 'Electrician', 'Mechanic', 'Welder', 'Tailor', 'Painter', 'Barber', 'Hair Stylist', 'AC Repair', 'Phone Repair', 'Computer Repair', 'Solar Installer', 'Generator Repair'],
  'Food & Restaurant': ['Restaurant', 'Fast Food', 'Food Vendor', 'Catering', 'Bakery', 'Cake Shop', 'Drinks Vendor'],
  'Transport & Logistics': ['Taxi', 'Car Hire', 'Bike Rider', 'Delivery Rider', 'Logistics', 'Moving Service'],
  'Beauty & Fashion': ['Salon', 'Makeup Artist', 'Spa', 'Fashion Designer', 'Nail Studio', 'Wig Seller'],
  'Health & Medical': ['Pharmacy', 'Clinic', 'Laboratory', 'Dental Clinic', 'Physiotherapy'],
  'Retail & Shops': ['Supermarket', 'Electronics Shop', 'Phone Shop', 'Clothing Store', 'Hardware Store'],
  'Construction & Real Estate': ['Building Contractor', 'Real Estate Agent', 'Roofing Company', 'Civil Engineer'],
  'Media & Event Services': ['Photographer', 'Videographer', 'DJ', 'Event Planner', 'MC'],
  'Technology & IT': ['Software Developer', 'Web Developer', 'IT Support', 'Computer Store'],
  'Home & Personal Services': ['Laundry', 'Cleaning Service', 'Caregiver', 'Pest Control', 'Home Chef'],
  'Agriculture & Farming': ['Poultry', 'Fish Farm', 'Crop Farming', 'Farm Produce Seller'],
};

const CATEGORY_ICONS = {
  'Handwork & Skilled Workers': '🛠️',
  'Food & Restaurant': '🍔',
  'Transport & Logistics': '🚗',
  'Beauty & Fashion': '💄',
  'Health & Medical': '💊',
  'Retail & Shops': '🛍️',
  'Construction & Real Estate': '🏗️',
  'Media & Event Services': '🎥',
  'Technology & IT': '💻',
  'Home & Personal Services': '🏠',
  'Agriculture & Farming': '🌾',
};

export default function FlashJobScreen({ navigation }) {
  const insets = useSafeAreaInsets();
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

  const scrollRef = useRef(null);
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

  const submitFlash = () => {
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please enter your location');
      return;
    }
    if (budgetType === 'Fixed Price' && !fixedBudget) {
      Alert.alert('Budget Required', 'Please enter your budget');
      return;
    }
    Alert.alert(
      '⚡ Flash Job Sent!',
      'Your request has been flashed to 15 nearby ' + subcategory + ' workers. The first to accept wins!',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  const subs = category ? (CATEGORIES[category] || []) : [];

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
          style={[st.nextBtn, step === 2 && { flex: 1 }]}
          onPress={step === 1 ? goNext : submitFlash}
          activeOpacity={0.85}
        >
          {step === 1 ? (
            <Text style={st.nextBtnText}>Next →</Text>
          ) : (
            <View style={st.flashBtnContent}>
              <Text style={st.flashBtnIcon}>⚡</Text>
              <Text style={st.nextBtnText}>Flash Job</Text>
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
