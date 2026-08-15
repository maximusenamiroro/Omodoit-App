import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { supabase } from '../../api/supabase';
import { findCategoryLoose } from '../../lib/categories';

export default function SubCategoriesScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { categoryName } = route.params;
  const category = findCategoryLoose(categoryName) || { emoji: '📂', color: colors.primary, subs: [], name: categoryName };

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

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
  }, [headerOpacity, listOpacity, listSlide]);

  // Real worker counts per subcategory, matched against the category's
  // canonical full name (via findCategoryLoose, which also tolerates
  // any older profile rows saved under a slightly different name).
  useEffect(() => {
    const fetchCounts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('subcategory')
          .eq('role', 'worker')
          .eq('category', category.name)
          .not('subcategory', 'is', null);

        if (error) throw error;

        const tally: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          if (row.subcategory) tally[row.subcategory] = (tally[row.subcategory] || 0) + 1;
        });
        setCounts(tally);
      } catch (err) {
        console.error('Failed to load subcategory counts:', err);
        setCounts({});
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [category.name]);

  const totalWorkers = Object.values(counts).reduce((sum, n) => sum + n, 0);

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
          {loading ? 'Loading…' : `${totalWorkers} workers available · ${category.subs.length} specializations`}
        </Text>
      </Animated.View>

      {/* Subcategories list */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={category.color} />
          </View>
        ) : (
          <Animated.View style={{ opacity: listOpacity, transform: [{ translateY: listSlide }], paddingHorizontal: spacing.screenPadding }}>
            {category.subs.map((subName, i) => (
              <TouchableOpacity
                key={i}
                style={styles.subRow}
                onPress={() => navigation.navigate('WorkerList', { categoryName: category.name, subcategoryName: subName, color: category.color })}
                activeOpacity={0.7}
              >
                <View style={[styles.subIconBg, { backgroundColor: category.color + '12' }]}>
                  <Text style={styles.subIcon}>{category.emoji}</Text>
                </View>
                <View style={styles.subInfo}>
                  <Text style={styles.subName}>{subName}</Text>
                  <Text style={styles.subWorkers}>
                    {counts[subName] || 0} worker{counts[subName] === 1 ? '' : 's'} available
                  </Text>
                </View>
                <Text style={[styles.subArrow, { color: category.color }]}>→</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
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
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  subRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  subIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  subIcon: { fontSize: 20 },
  subInfo: { flex: 1 },
  subName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  subWorkers: { fontSize: 11, color: colors.textMuted },
  subArrow: { fontSize: 16, fontWeight: '600' },
});
