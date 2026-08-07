import React, { useEffect, useRef, useState } from 'react';
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

const MOCK_WORKERS = [
  { id: '1', name: 'John Adewale', rating: 4.9, reviews: 47, location: 'Ikeja, Lagos', experience: '5-10 years', verified: true, bio: 'Professional electrician with 8 years experience. Fast, reliable, and affordable.' },
  { id: '2', name: 'Blessing Eze', rating: 5.0, reviews: 118, location: 'Lekki, Lagos', experience: '10+ years', verified: true, bio: 'Expert in all electrical installations. Commercial and residential.' },
  { id: '3', name: 'Emeka Nwosu', rating: 4.7, reviews: 31, location: 'Surulere, Lagos', experience: '3-5 years', verified: false, bio: 'Quick response time. Available 24/7 for emergencies.' },
  { id: '4', name: 'Tunde Bakare', rating: 4.6, reviews: 24, location: 'Yaba, Lagos', experience: '1-3 years', verified: true, bio: 'Certified technician. Specializes in AC repair and installation.' },
  { id: '5', name: 'Fatima Hassan', rating: 4.8, reviews: 56, location: 'Maryland, Lagos', experience: '5-10 years', verified: true, bio: 'Trusted by over 200 clients. Quality work guaranteed.' },
  { id: '6', name: 'David Okonkwo', rating: 4.5, reviews: 19, location: 'Ajah, Lagos', experience: '3-5 years', verified: false, bio: 'Affordable rates. Free inspection for new customers.' },
];

type SortOption = 'rating' | 'reviews' | 'nearest';

export default function WorkerListScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { categoryName, subcategoryName, color } = route.params;
  const accentColor = color || colors.primary;

  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [workers, setWorkers] = useState(MOCK_WORKERS);

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

  useEffect(() => {
    const sorted = [...MOCK_WORKERS];
    if (sortBy === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    if (sortBy === 'reviews') sorted.sort((a, b) => b.reviews - a.reviews);
    setWorkers(sorted);
  }, [sortBy]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{subcategoryName}</Text>
          <Text style={styles.headerSub}>{categoryName}</Text>
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      {/* Sort options */}
      <Animated.View style={[styles.sortRow, { opacity: headerOpacity }]}>
        {([['rating', '⭐ Rating'], ['reviews', '💬 Reviews'], ['nearest', '📍 Nearest']] as [SortOption, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.sortChip, sortBy === key && { backgroundColor: accentColor + '15', borderColor: accentColor + '40' }]}
            onPress={() => setSortBy(key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.sortText, sortBy === key && { color: accentColor, fontWeight: '700' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      <Text style={styles.resultCount}>{workers.length} workers found</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>
        <Animated.View style={{ opacity: listOpacity, transform: [{ translateY: listSlide }], paddingHorizontal: spacing.screenPadding }}>
          {workers.map((worker, i) => (
            <TouchableOpacity
              key={worker.id}
              style={styles.workerCard}
              onPress={() => navigation.navigate('WorkerPublicProfile', { worker, color: accentColor, subcategoryName })}
              activeOpacity={0.85}
            >
              <View style={styles.workerTop}>
                <View style={[styles.workerAvatar, { backgroundColor: accentColor }]}>
                  <Text style={styles.workerAvatarText}>{getInitials(worker.name)}</Text>
                </View>
                <View style={styles.workerInfo}>
                  <View style={styles.workerNameRow}>
                    <Text style={styles.workerName}>{worker.name}</Text>
                    {worker.verified && (
                      <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>
                    )}
                  </View>
                  <Text style={styles.workerLocation}>📍 {worker.location}</Text>
                  <View style={styles.workerRatingRow}>
                    <Text style={styles.workerStar}>⭐</Text>
                    <Text style={styles.workerRating}>{worker.rating}</Text>
                    <Text style={styles.workerReviews}>({worker.reviews} reviews)</Text>
                    <Text style={styles.workerExp}>· {worker.experience}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.workerBio} numberOfLines={2}>{worker.bio}</Text>
              <View style={styles.workerActions}>
                <TouchableOpacity
                  style={[styles.bookBtn, { backgroundColor: accentColor }]}
                  onPress={() => navigation.navigate('HireWorker', { worker, subcategoryName })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.bookBtnText}>📋 Book Now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.messageBtn} activeOpacity={0.85}>
                  <Text style={styles.messageBtnText}>💬 Message</Text>
                </TouchableOpacity>
              </View>
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
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  sortRow: { flexDirection: 'row', paddingHorizontal: spacing.screenPadding, gap: 8, paddingVertical: 12 },
  sortChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  sortText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  resultCount: { fontSize: 11, color: colors.textMuted, paddingHorizontal: spacing.screenPadding, marginBottom: 8 },
  workerCard: { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  workerTop: { flexDirection: 'row', marginBottom: 10 },
  workerAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  workerAvatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  workerInfo: { flex: 1 },
  workerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  workerName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  verifiedBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.info, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { fontSize: 8, fontWeight: '700', color: colors.white },
  workerLocation: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  workerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  workerStar: { fontSize: 11 },
  workerRating: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  workerReviews: { fontSize: 10, color: colors.textMuted },
  workerExp: { fontSize: 10, color: colors.textMuted },
  workerBio: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: 12 },
  workerActions: { flexDirection: 'row', gap: 10 },
  bookBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  bookBtnText: { fontSize: 13, fontWeight: '600', color: colors.white },
  messageBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  messageBtnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
});
