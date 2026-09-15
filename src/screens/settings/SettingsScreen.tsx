import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Animated, StatusBar, Alert, Platform, Linking, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASING, colors, spacing, useEntrance } from '../../theme';
import Icon from '../../components/common/Icon';
import PressableScale from '../../components/common/PressableScale';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';

interface SettingsItem {
  icon: string;
  label: string;
  desc: string;
  action?: () => void;
  danger?: boolean;
}

// Filled in once the listings exist. Until then it points at the site,
// which is a real destination rather than a dead end.
const RATE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/omodoit',
  android: 'https://play.google.com/store/apps/details?id=com.omodoit',
  default: 'https://www.omodoit.com',
}) as string;

export default function SettingsScreen({ navigation }: any) {
  const entrance = useEntrance();
  const insets = useSafeAreaInsets();
  const { user, profile, role, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const accentColor = role === 'client' ? colors.client : colors.primary;

  const handleChangePassword = async () => {
    if (!user?.email) return;
    Alert.alert(
      'Change Password',
      `We'll send a password reset link to ${user.email}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link', onPress: async () => {
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(user.email!);
              if (error) throw error;
              Alert.alert('Check Your Email', 'A password reset link has been sent.');
            } catch (err) {
              console.error('Password reset error:', err);
              Alert.alert('Something Went Wrong', 'Could not send the reset link. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out Omodoit — find skilled workers or grow your business in Nigeria. https://www.omodoit.com',
      });
    } catch (err) {
      console.warn('Share failed:', err);
    }
  };

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.stagger(entrance.stagger, [
      Animated.timing(headerOpacity, { toValue: 1, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
        Animated.timing(contentSlide, { toValue: 0, duration: entrance.fade, easing: EASING.OUT, useNativeDriver: true }),
      ]),
    ]).start();
  }, [contentOpacity, contentSlide, headerOpacity]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  // Deletion happens in the app, not by email.
  //
  // This used to open an alert telling people to write to support, which
  // is the pattern Apple's Guideline 5.1.1(v) names as insufficient: an
  // app that offers account creation must offer account deletion inside
  // the app. Deleting the test account is part of every review pass, so
  // it would have been found in the first two minutes.
  //
  // Two confirmations, because it genuinely cannot be undone and the
  // button sits one tap away from ordinary settings. The second one
  // spells out what goes, since "all your data" means a worker's reels
  // and reviews as well as their login.
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, your reels, your messages and your reviews. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => Alert.alert(
            'Are you sure?',
            'There is no way to get your account back afterwards.',
            [
              { text: 'Keep my account', style: 'cancel' },
              { text: 'Delete forever', style: 'destructive', onPress: runDeleteAccount },
            ],
          ),
        },
      ]
    );
  };

  const runDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account');
      if (error || !data?.deleted) {
        setDeleting(false);
        Alert.alert(
          'Could not delete your account',
          data?.error || 'Something went wrong. Please try again, or email support@omodoit.com.',
        );
        return;
      }
      // The account no longer exists, so the stored session is a token
      // for nothing. Signing out clears it and drops back to the login
      // screen, which is where a deleted user belongs.
      await logout();
    } catch (err: any) {
      setDeleting(false);
      Alert.alert('Could not delete your account', err?.message || 'Please try again.');
    }
  };

  const accountSettings: SettingsItem[] = [
    { icon: '👤', label: 'Edit Profile', desc: 'Name, photo, location', action: () => navigation.navigate('EditProfile') },
    { icon: '🔒', label: 'Change Password', desc: 'Update your password', action: handleChangePassword },
    { icon: '📧', label: 'Email', desc: user?.email || 'Not set' },
    { icon: '🔔', label: 'Notifications', desc: 'Push notification settings', action: () => navigation.navigate('Notifications') },
  ];

  const privacySettings: SettingsItem[] = [
    { icon: '🚫', label: 'Blocked Users', desc: 'Manage blocked accounts', action: () => navigation.navigate('BlockedUsers') },
    { icon: '📍', label: 'Location Settings', desc: 'Manage location permission', action: () => Linking.openSettings() },
  ];

  const supportItems: SettingsItem[] = [
    { icon: '❓', label: 'Help Center', desc: 'FAQs and support', action: () => Linking.openURL('https://www.omodoit.com/Help') },
    { icon: '💬', label: 'Contact Us', desc: 'Get in touch with our team', action: () => Linking.openURL('mailto:support@omodoit.com') },
    { icon: '⭐', label: 'Rate Omodoit', desc: 'Love the app? Rate us!', action: () => Linking.openURL(RATE_URL) },
    { icon: '📣', label: 'Share Omodoit', desc: 'Tell your friends about us', action: handleShare },
  ];

  const legalItems: SettingsItem[] = [
    // Apple's Guideline 1.2 expects the content standards to be
    // published where users can actually find them. The page existed but
    // nothing in the app pointed at it, which does not count.
    { icon: '📜', label: 'Community Guidelines', desc: 'What is and is not allowed', action: () => Linking.openURL('https://www.omodoit.com/Community%20Guidelines') },
    { icon: '📄', label: 'Terms of Use', desc: 'Our terms and conditions', action: () => Linking.openURL('https://www.omodoit.com/Terms%20Of%20Use') },
    { icon: '🔐', label: 'Privacy Policy', desc: 'How we protect your data', action: () => Linking.openURL('https://www.omodoit.com/Privacy%20Policy') },
  ];

  const renderSection = (title: string, items: SettingsItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.settingsCard}>
        {items.map((item, i) => (
          <PressableScale
            key={i}
            style={styles.settingsRow}
            onPress={item.action}
          >
            <Text style={styles.settingsIcon}>{item.icon}</Text>
            <View style={styles.settingsInfo}>
              <Text style={[styles.settingsLabel, item.danger && { color: colors.error }]}>{item.label}</Text>
              <Text style={styles.settingsDesc}>{item.desc}</Text>
            </View>
            <Text style={styles.settingsArrow}>→</Text>
            {i < items.length - 1 && <View style={styles.settingsDivider} />}
          </PressableScale>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="back" size={20} color={colors.white} />
        </PressableScale>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </Animated.View>

      <Animated.View style={{ flex: 1, opacity: contentOpacity, transform: [{ translateY: contentSlide }] }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}>

          {/* Profile summary at top */}
          <View style={styles.profileSummary}>
            <View style={[styles.summaryAvatar, { backgroundColor: accentColor }]}>
              <Text style={styles.summaryAvatarText}>
                {profile?.full_name ? profile.full_name.trim().split(' ').map((p: string) => p[0]).join('').slice(0, 2) : '?'}
              </Text>
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryName}>{profile?.full_name || 'User'}</Text>
              <Text style={styles.summaryRole}>
                {role === 'client' ? '👤 Client Account' : '🔨 Worker Account'}
              </Text>
            </View>
          </View>

          {renderSection('Account', accountSettings)}
          {renderSection('Privacy & Security', privacySettings)}
          {renderSection('Support', supportItems)}
          {renderSection('Legal', legalItems)}

          {/* Danger zone */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <View style={styles.settingsCard}>
              <PressableScale style={styles.settingsRow} onPress={handleLogout}>
                <Text style={styles.settingsIcon}>🚪</Text>
                <View style={styles.settingsInfo}>
                  <Text style={[styles.settingsLabel, { color: colors.error }]}>Sign Out</Text>
                  <Text style={styles.settingsDesc}>Log out of your account</Text>
                </View>
                <Text style={[styles.settingsArrow, { color: colors.error }]}>→</Text>
              </PressableScale>
              <View style={styles.settingsDivider} />
              <PressableScale style={styles.settingsRow} onPress={handleDeleteAccount} disabled={deleting}>
                <Text style={styles.settingsIcon}>⚠️</Text>
                <View style={styles.settingsInfo}>
                  <Text style={[styles.settingsLabel, { color: colors.error }]}>Delete Account</Text>
                  <Text style={styles.settingsDesc}>
                    {deleting ? 'Deleting your account…' : 'Permanently delete your account'}
                  </Text>
                </View>
                {deleting
                  ? <ActivityIndicator size="small" color={colors.error} />
                  : <Text style={[styles.settingsArrow, { color: colors.error }]}>→</Text>}
              </PressableScale>
            </View>
          </View>

          <Text style={styles.versionText}>Omodoit v1.0.0{'\n'}Made with ❤️ in Nigeria 🇳🇬</Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  profileSummary: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPadding, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  summaryAvatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  summaryInfo: { flex: 1 },
  summaryName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  summaryRole: { fontSize: 12, color: colors.textMuted },

  section: { marginTop: 24, paddingHorizontal: spacing.screenPadding },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  settingsCard: { backgroundColor: colors.bgCard, borderRadius: spacing.radiusLg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  settingsIcon: { fontSize: 18, marginRight: 14 },
  settingsInfo: { flex: 1 },
  settingsLabel: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 2 },
  settingsDesc: { fontSize: 11, color: colors.textMuted },
  settingsArrow: { fontSize: 14, color: colors.textMuted, marginLeft: 8 },
  settingsDivider: { position: 'absolute', bottom: 0, left: 46, right: 0, height: 1, backgroundColor: colors.border },

  versionText: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 32, marginBottom: 20, lineHeight: 18, opacity: 0.5 },
});
