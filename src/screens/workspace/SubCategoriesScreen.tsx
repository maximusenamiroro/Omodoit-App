import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';

const CATEGORY_DATA: Record<string, { emoji: string; color: string; subs: { name: string; workers: number; icon: string }[] }> = {
  'Handwork': {
    emoji: '🔨', color: '#16a34a',
    subs: [
      { name: 'Electrician', workers: 12, icon: '⚡' },
      { name: 'Plumber', workers: 8, icon: '🔧' },
      { name: 'Carpenter', workers: 6, icon: '🪚' },
      { name: 'Welder', workers: 5, icon: '🔩' },
      { name: 'Painter', workers: 7, icon: '🎨' },
      { name: 'AC Repair', workers: 4, icon: '❄️' },
      { name: 'Tiler', workers: 3, icon: '🧱' },
      { name: 'Mason', workers: 5, icon: '🏗️' },
      { name: 'Tailor', workers: 9, icon: '👗' },
    ],
  },
  'Food': {
    emoji: '🍽️', color: '#F97316',
    subs: [
      { name: 'Caterer', workers: 15, icon: '🍲' },
      { name: 'Home Chef', workers: 8, icon: '👨‍🍳' },
      { name: 'Baker', workers: 6, icon: '🍰' },
      { name: 'Restaurant', workers: 4, icon: '🏪' },
      { name: 'Food Vendor', workers: 10, icon: '🍛' },
      { name: 'Drinks', workers: 3, icon: '🥤' },
    ],
  },
  'Transport': {
    emoji: '🚗', color: '#3B82F6',
    subs: [
      { name: 'Driver', workers: 10, icon: '🚙' },
      { name: 'Dispatch Rider', workers: 8, icon: '🏍️' },
      { name: 'Moving Service', workers: 3, icon: '🚚' },
      { name: 'Courier', workers: 5, icon: '📦' },
      { name: 'Haulage', workers: 2, icon: '🚛' },
    ],
  },
  'Beauty': {
    emoji: '💄', color: '#D946EF',
    subs: [
      { name: 'Makeup Artist', workers: 14, icon: '💄' },
      { name: 'Hair Stylist', workers: 12, icon: '💇' },
      { name: 'Barber', workers: 8, icon: '✂️' },
      { name: 'Fashion Designer', workers: 5, icon: '👗' },
      { name: 'Nail Tech', workers: 6, icon: '💅' },
      { name: 'Spa', workers: 3, icon: '🧖' },
    ],
  },
  'Tech & IT': {
    emoji: '💻', color: '#06B6D4',
    subs: [
      { name: 'Software Dev', workers: 5, icon: '💻' },
      { name: 'Phone Repair', workers: 8, icon: '📱' },
      { name: 'Computer Repair', workers: 4, icon: '🖥️' },
      { name: 'CCTV Install', workers: 3, icon: '📷' },
      { name: 'Networking', workers: 2, icon: '🌐' },
    ],
  },
  'Construction': {
    emoji: '🏗️', color: '#EAB308',
    subs: [
      { name: 'Builder', workers: 6, icon: '🧱' },
      { name: 'Architect', workers: 3, icon: '📐' },
      { name: 'Surveyor', workers: 2, icon: '📏' },
      { name: 'Interior Design', workers: 4, icon: '🛋️' },
      { name: 'Roofing', workers: 3, icon: '🏠' },
    ],
  },
  'Health': {
    emoji: '🏥', color: '#EF4444',
    subs: [
      { name: 'Nurse', workers: 4, icon: '🏥' },
      { name: 'Physiotherapist', workers: 2, icon: '💪' },
      { name: 'Pharmacist', workers: 3, icon: '💊' },
      { name: 'Caregiver', workers: 5, icon: '🤲' },
      { name: 'Lab Tech', workers: 2, icon: '🔬' },
    ],
  },
  'Retail': {
    emoji: '🛒', color: '#8B5CF6',
    subs: [
      { name: 'General Store', workers: 10, icon: '🏪' },
      { name: 'Phone Accessories', workers: 6, icon: '📱' },
      { name: 'Electronics', workers: 5, icon: '🔌' },
      { name: 'Clothing', workers: 8, icon: '👕' },
      { name: 'Auto Parts', workers: 4, icon: '🔧' },
    ],
  },
};

export default function SubCategoriesScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { categoryName } = route.params;
  const category = CATEGORY_DATA[categoryName] || { emoji: '📂', color: colors.primary, subs: [] };

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(listOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(listSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const totalWorkers = category.subs.reduce((sum, s) => sum + s.workers, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{category.emoji}</Text>
          <Text style={styles.headerTitle}>{categoryName}</Text>
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      {/* Stats banner */}
      <Animated.View style={[styles.statsBanner, { opacity: headerOpacity, backgroundColor: category.color + '10', borderColor: category.color + '25' }]}>
        <Text style={[styles.statsText, { color: category.color }]}>
          {totalWorkers} workers available · {category.subs.length} specializations
        </Text>
      </Animated.View>

      {/* Subcategories list */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>
        <Animated.View style={{ opacity: listOpacity, transform: [{ translateY: listSlide }], paddingHorizontal: spacing.screenPadding }}>
          {category.subs.map((sub, i) => (
            <TouchableOpacity
              key={i}
              style={styles.subRow}
              onPress={() => navigation.navigate('WorkerList', { categoryName, subcategoryName: sub.name, color: category.color })}
              activeOpacity={0.7}
            >
              <View style={[styles.subIconBg, { backgroundColor: category.color + '12' }]}>
                <Text style={styles.subIcon}>{sub.icon}</Text>
              </View>
              <View style={styles.subInfo}>
                <Text style={styles.subName}>{sub.name}</Text>
                <Text style={styles.subWorkers}>{sub.workers} workers available</Text>
              </View>
              <Text style={[styles.subArrow, { color: category.color }]}>→</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerEmoji: { fontSize: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  statsBanner: { marginHorizontal: spacing.screenPadding, marginVertical: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  statsText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  subRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  subIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  subIcon: { fontSize: 20 },
  subInfo: { flex: 1 },
  subName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  subWorkers: { fontSize: 11, color: colors.textMuted },
  subArrow: { fontSize: 16, fontWeight: '600' },
});
