import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

const MOCK_REVIEWS = [
  { id: '1', name: 'Sarah A.', rating: 5, text: 'Excellent work! Came on time and fixed everything quickly.', date: '2 weeks ago' },
  { id: '2', name: 'Michael O.', rating: 5, text: 'Very professional. Would definitely hire again.', date: '1 month ago' },
  { id: '3', name: 'Fatima H.', rating: 4, text: 'Good job overall. A bit late but quality was great.', date: '2 months ago' },
];

export default function WorkerPublicProfileScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { worker, color, subcategoryName } = route.params;
  const accentColor = color || colors.primary;

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(0.95)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(headerScale, { toValue: 1, damping: 15, stiffness: 100, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(contentSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
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
        <Text style={styles.headerTitle}>Worker Profile</Text>
        <TouchableOpacity style={styles.shareBtn} activeOpacity={0.7}>
          <Text style={styles.shareIcon}>↗️</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}>
        {/* Profile header */}
        <Animated.View style={[styles.profileHeader, { opacity: headerOpacity, transform: [{ scale: headerScale }] }]}>
          <View style={[styles.avatar, { backgroundColor: accentColor }]}>
            <Text style={styles.avatarText}>{getInitials(worker.name)}</Text>
          </View>
          <Text style={styles.name}>{worker.name}</Text>
          <Text style={styles.category}>{subcategoryName}</Text>

          <View style={styles.ratingRow}>
            <Text style={styles.ratingStar}>⭐</Text>
            <Text style={styles.ratingValue}>{worker.rating}</Text>
            <Text style={styles.ratingReviews}>({worker.reviews} reviews)</Text>
          </View>

          <View style={styles.badgesRow}>
            {worker.verified && (
              <View style={[styles.badge, { backgroundColor: colors.info + '15', borderColor: colors.info + '30' }]}>
                <Text style={[styles.badgeText, { color: colors.info }]}>✓ Verified</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: accentColor + '15', borderColor: accentColor + '30' }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>{worker.experience}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>📍 {worker.location}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentSlide }] }}>
          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.bioText}>{worker.bio}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stats</Text>
            <View style={styles.statsRow}>
              {[
                { value: worker.reviews.toString(), label: 'Reviews', color: colors.flash },
                { value: worker.rating.toString(), label: 'Rating', color: accentColor },
                { value: '98%', label: 'Response', color: colors.primary },
                { value: '< 1hr', label: 'Avg Time', color: colors.info },
              ].map((stat, i) => (
                <View key={i} style={styles.statItem}>
                  <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Reviews */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              <TouchableOpacity><Text style={styles.seeAll}>See all →</Text></TouchableOpacity>
            </View>
            {MOCK_REVIEWS.map(review => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View style={styles.reviewAvatarSmall}>
                    <Text style={styles.reviewAvatarText}>{review.name[0]}</Text>
                  </View>
                  <View style={styles.reviewInfo}>
                    <Text style={styles.reviewName}>{review.name}</Text>
                    <Text style={styles.reviewDate}>{review.date}</Text>
                  </View>
                  <View style={styles.reviewStars}>
                    {Array.from({ length: review.rating }, (_, i) => (
                      <Text key={i} style={styles.reviewStarIcon}>⭐</Text>
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewText}>{review.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16 }]}>
        <TouchableOpacity style={styles.msgActionBtn} activeOpacity={0.85}>
          <Text style={styles.msgActionIcon}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.callActionBtn}
          onPress={() => navigation.navigate('OutgoingCall', { workerName: worker.name, workerCategory: subcategoryName })}
          activeOpacity={0.85}
        >
          <Text style={styles.callActionIcon}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bookActionBtn, { backgroundColor: accentColor }]}
          onPress={() => navigation.navigate('HireWorker', { worker, subcategoryName })}
          activeOpacity={0.85}
        >
          <Text style={styles.bookActionText}>📋 Book Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  shareBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  shareIcon: { fontSize: 16 },

  profileHeader: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: spacing.screenPadding },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.white },
  name: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  category: { fontSize: 14, color: colors.textMuted, marginBottom: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  ratingStar: { fontSize: 14 },
  ratingValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  ratingReviews: { fontSize: 12, color: colors.textMuted },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  section: { paddingHorizontal: spacing.screenPadding, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  seeAll: { fontSize: 12, fontWeight: '600', color: colors.client },
  sectionCard: { backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  bioText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  statsRow: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  statLabel: { fontSize: 10, color: colors.textMuted },

  reviewCard: { backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewAvatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  reviewAvatarText: { fontSize: 12, fontWeight: '700', color: colors.white },
  reviewInfo: { flex: 1 },
  reviewName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  reviewDate: { fontSize: 10, color: colors.textMuted },
  reviewStars: { flexDirection: 'row' },
  reviewStarIcon: { fontSize: 10 },
  reviewText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  bottomBar: { flexDirection: 'row', paddingHorizontal: spacing.screenPadding, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, gap: 10 },
  msgActionBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  msgActionIcon: { fontSize: 20 },
  callActionBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  callActionIcon: { fontSize: 20 },
  bookActionBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bookActionText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
