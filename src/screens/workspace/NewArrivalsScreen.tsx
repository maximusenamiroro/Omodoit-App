import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

const ALL_ARRIVALS = [
  { id: '1', category: 'Electrician', emoji: '⚡', posterName: 'John Adewale', time: '2h ago', products: 3, color: '#16a34a' },
  { id: '2', category: 'Caterer', emoji: '🍱', posterName: 'Chidinma Okafor', time: '4h ago', products: 5, color: '#F97316' },
  { id: '3', category: 'Makeup Artist', emoji: '💄', posterName: 'Blessing Eze', time: '6h ago', products: 2, color: '#D946EF' },
  { id: '4', category: 'Phone Repair', emoji: '📱', posterName: 'Tunde Bakare', time: '8h ago', products: 4, color: '#06B6D4' },
  { id: '5', category: 'Barber', emoji: '💈', posterName: 'David Okonkwo', time: '10h ago', products: 1, color: '#EAB308' },
  { id: '6', category: 'Plumber', emoji: '🔧', posterName: 'Emeka Nwosu', time: '12h ago', products: 2, color: '#3B82F6' },
  { id: '7', category: 'Baker', emoji: '🍞', posterName: 'Fatima Hassan', time: '18h ago', products: 6, color: '#F97316' },
  { id: '8', category: 'Tailor', emoji: '🧵', posterName: 'Amina Kalu', time: '20h ago', products: 3, color: '#8B5CF6' },
  { id: '9', category: 'Mechanic', emoji: '🔩', posterName: 'Ibrahim Musa', time: '24h ago', products: 2, color: '#78716C' },
  { id: '10', category: 'Photographer', emoji: '📸', posterName: 'Grace Ojo', time: '30h ago', products: 8, color: '#06B6D4' },
  { id: '11', category: 'Driver', emoji: '🚙', posterName: 'Samuel Ade', time: '36h ago', products: 1, color: '#3B82F6' },
  { id: '12', category: 'Cleaner', emoji: '🧹', posterName: 'Ngozi Ibe', time: '42h ago', products: 2, color: '#14B8A6' },
];

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

export default function NewArrivalsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>New Arrivals</Text>
          <Text style={styles.headerSub}>Products posted in the last 48 hours</Text>
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      {/* Stats bar */}
      <Animated.View style={[styles.statsBanner, { opacity: headerOpacity }]}>
        <Text style={styles.statsText}>
          {ALL_ARRIVALS.length} new listings · {ALL_ARRIVALS.reduce((s, a) => s + a.products, 0)} products
        </Text>
      </Animated.View>

      {/* List — one item per line */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
      >
        <Animated.View style={{
          opacity: listOpacity, transform: [{ translateY: listSlide }],
          paddingHorizontal: spacing.screenPadding,
        }}>
          {ALL_ARRIVALS.map((item, i) => (
            <TouchableOpacity key={item.id} style={styles.arrivalRow} activeOpacity={0.85}>
              {/* Avatar with story ring */}
              <View style={[styles.rowRing, { borderColor: item.color }]}>
                <View style={[styles.rowAvatar, { backgroundColor: item.color + '15' }]}>
                  <Text style={styles.rowEmoji}>{item.emoji}</Text>
                </View>
              </View>

              {/* Info */}
              <View style={styles.rowInfo}>
                <Text style={styles.rowCategory}>{item.category}</Text>
                <Text style={styles.rowPoster}>@{item.posterName}</Text>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTime}>{item.time}</Text>
                  <Text style={styles.rowDot}>·</Text>
                  <Text style={styles.rowProducts}>{item.products} new products</Text>
                </View>
              </View>

              {/* View button */}
              <TouchableOpacity style={[styles.viewBtn, { backgroundColor: item.color + '15', borderColor: item.color + '30' }]} activeOpacity={0.85}>
                <Text style={[styles.viewBtnText, { color: item.color }]}>View</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  statsBanner: {
    marginHorizontal: spacing.screenPadding, marginVertical: 12,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.primary + '10', borderWidth: 1, borderColor: colors.primary + '25',
  },
  statsText: { fontSize: 12, fontWeight: '600', color: colors.primary, textAlign: 'center' },

  // Arrival rows — one per line
  arrivalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  rowRing: {
    width: 52, height: 52, borderRadius: 26, padding: 2,
    borderWidth: 2, marginRight: 14,
  },
  rowAvatar: {
    width: '100%', height: '100%', borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  rowEmoji: { fontSize: 22 },
  rowInfo: { flex: 1 },
  rowCategory: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  rowPoster: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowTime: { fontSize: 10, color: colors.textMuted },
  rowDot: { fontSize: 10, color: colors.textMuted },
  rowProducts: { fontSize: 10, color: colors.primary, fontWeight: '500' },
  viewBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, marginLeft: 10,
  },
  viewBtnText: { fontSize: 12, fontWeight: '600' },
});
