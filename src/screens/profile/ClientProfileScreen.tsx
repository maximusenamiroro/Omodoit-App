import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';

export default function ClientProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { profile, logout } = useAuth();

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(0.95)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(20)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(headerScale, { toValue: 1, damping: 15, stiffness: 100, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(statsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(statsSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(actionsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(actionsSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => { await logout(); },
        },
      ]
    );
  };

  const getInitials = () => {
    if (!profile?.full_name) return '?';
    const parts = profile.full_name.trim().split(' ');
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return parts[0][0];
  };

  const getVerificationBadge = () => {
    const level = profile?.verification_level ?? 0;
    if (level >= 3) return { label: 'Business Verified', color: colors.primary, icon: '✓' };
    if (level >= 2) return { label: 'ID Verified', color: colors.info, icon: '✓' };
    if (level >= 1) return { label: 'Phone Verified', color: colors.textMuted, icon: '✓' };
    return { label: 'Unverified', color: colors.textMuted, icon: '○' };
  };

  const badge = getVerificationBadge();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <Animated.View style={[styles.headerSection, {
          opacity: headerOpacity,
          transform: [{ scale: headerScale }],
        }]}>
          {/* Background accent */}
          <View style={styles.headerBackground} />

          {/* Top row — Settings + Logout */}
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
              <Text style={styles.iconText}>⚙️</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editAvatarBtn} activeOpacity={0.7}>
              <Text style={styles.editAvatarIcon}>📷</Text>
            </TouchableOpacity>
          </View>

          {/* Name and info */}
          <Text style={styles.userName}>{profile?.full_name || 'User'}</Text>

          <Text style={styles.userMeta}>
            {profile?.location || 'Location not set'} · Member since {
              profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : 'Today'
            }
          </Text>

          {/* Verification badge */}
          <View style={[styles.verificationBadge, { borderColor: badge.color + '40' }]}>
            <Text style={[styles.badgeIcon, { color: badge.color }]}>{badge.icon}</Text>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>

          {/* Edit profile button */}
          <TouchableOpacity style={styles.editProfileBtn} activeOpacity={0.85}>
            <Text style={styles.editProfileText}>✏️  Edit Profile</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[styles.statsCard, {
          opacity: statsOpacity,
          transform: [{ translateY: statsSlide }],
        }]}>
          {[
            { value: '0', label: 'Bookings', color: colors.textPrimary },
            { value: '0', label: 'Orders', color: colors.textPrimary },
            { value: '—', label: 'Rating', color: colors.flash },
            { value: '₦0', label: 'Spent', color: colors.client },
          ].map((stat, i) => (
            <React.Fragment key={i}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
              {i < 3 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View style={{
          opacity: actionsOpacity,
          transform: [{ translateY: actionsSlide }],
        }}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={styles.actionsGrid}>
            {[
              { icon: '📋', label: 'My Bookings', sub: 'View all bookings', color: colors.primary },
              { icon: '📦', label: 'My Orders', sub: 'Track your orders', color: colors.client },
            ].map((action, i) => (
              <TouchableOpacity key={i} style={styles.actionCard} activeOpacity={0.85}>
                <View style={[styles.actionIconBg, { backgroundColor: action.color + '15' }]}>
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                  <Text style={styles.actionSub}>{action.sub}</Text>
                </View>
                <Text style={[styles.actionArrow, { color: action.color + '80' }]}>→</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.actionRow}>
              {[
                { icon: '⭐', label: 'Reviews', color: colors.flash },
                { icon: '⚡', label: 'Flash Jobs', color: colors.flash },
              ].map((action, i) => (
                <TouchableOpacity key={i} style={styles.actionCardSmall} activeOpacity={0.85}>
                  <View style={[styles.actionIconBgSmall, { backgroundColor: action.color + '15' }]}>
                    <Text style={styles.actionIconSmall}>{action.icon}</Text>
                  </View>
                  <Text style={styles.actionLabelSmall}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Recent Activity */}
        <Animated.View style={{ opacity: actionsOpacity }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>

          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyDesc}>
              Book a worker or send a Flash Job to get started!
            </Text>
          </View>
        </Animated.View>

        {/* App info */}
        <Text style={styles.versionText}>Omodoit v1.0.0 · Made in Nigeria 🇳🇬</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Header
  headerSection: {
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 12,
  },
  headerBackground: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 140,
    backgroundColor: colors.client + '08',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 8,
    marginBottom: 8,
  },
  iconButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white + '08',
    alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  logoutBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: spacing.radiusMd,
    backgroundColor: colors.error + '12',
    borderWidth: 1,
    borderColor: colors.error + '25',
  },
  logoutBtnText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.error,
  },

  // Avatar
  avatarContainer: {
    marginBottom: 12,
  },
  avatarRing: {
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 2.5,
    borderColor: colors.client + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: colors.client,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26, fontWeight: typography.bold, color: colors.white,
  },
  editAvatarBtn: {
    position: 'absolute', bottom: -2, right: -2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.client,
    alignItems: 'center', justifyContent: 'center',
  },
  editAvatarIcon: { fontSize: 13 },

  // Name
  userName: {
    fontSize: typography.xl, fontWeight: typography.bold,
    color: colors.textPrimary, marginBottom: 4,
  },
  userMeta: {
    fontSize: typography.xs, color: colors.textMuted, marginBottom: 10,
  },

  // Verification
  verificationBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: spacing.radiusFull, borderWidth: 1,
    backgroundColor: colors.bgCard, marginBottom: 12,
  },
  badgeIcon: {
    fontSize: 11, fontWeight: typography.bold, marginRight: 5,
  },
  badgeText: {
    fontSize: typography.xs, fontWeight: typography.semibold,
  },

  // Edit profile
  editProfileBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: spacing.radiusMd,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  editProfileText: {
    fontSize: typography.sm, fontWeight: typography.medium, color: colors.textPrimary,
  },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.screenPadding,
    padding: 14, marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: typography.md, fontWeight: typography.bold,
    color: colors.textPrimary, marginBottom: 3,
  },
  statLabel: { fontSize: typography.xs, color: colors.textMuted },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  // Section
  sectionTitle: {
    fontSize: typography.md, fontWeight: typography.bold,
    color: colors.textPrimary, marginBottom: 10,
    paddingHorizontal: spacing.screenPadding,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: spacing.screenPadding,
    marginBottom: 10,
  },

  // Actions
  actionsGrid: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 20,
  },
  actionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 8,
  },
  actionIconBg: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  actionIcon: { fontSize: 18 },
  actionInfo: { flex: 1 },
  actionLabel: {
    fontSize: typography.base, fontWeight: typography.semibold,
    color: colors.textPrimary, marginBottom: 2,
  },
  actionSub: { fontSize: typography.xs, color: colors.textMuted },
  actionArrow: { fontSize: 16, fontWeight: typography.medium },

  // Small action cards (side by side)
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionCardSmall: {
    flex: 1, alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 16,
  },
  actionIconBgSmall: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  actionIconSmall: { fontSize: 16 },
  actionLabelSmall: {
    fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textPrimary,
  },

  // Empty
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg,
    borderWidth: 1, borderColor: colors.border,
    padding: 28, marginHorizontal: spacing.screenPadding,
    marginBottom: 20,
  },
  emptyEmoji: { fontSize: 32, marginBottom: 10, opacity: 0.5 },
  emptyTitle: {
    fontSize: typography.base, fontWeight: typography.semibold,
    color: colors.textPrimary, marginBottom: 4,
  },
  emptyDesc: {
    fontSize: typography.sm, color: colors.textMuted,
    textAlign: 'center', lineHeight: 20,
  },

  // Version
  versionText: {
    fontSize: typography.xs, color: colors.textMuted,
    textAlign: 'center', marginBottom: 16, opacity: 0.5,
  },
});