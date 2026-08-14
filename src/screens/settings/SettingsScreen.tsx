import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, StatusBar, Alert, Platform, Linking, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';

interface SettingsItem {
  icon: string;
  label: string;
  desc: string;
  action?: () => void;
  danger?: boolean;
}

export default function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, profile, role, logout } = useAuth();
  const accentColor = role === 'client' ? colors.client : colors.primary;

  const comingSoon = (feature: string) => {
    Alert.alert(feature, 'This feature is coming soon.');
  };

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
        message: 'Check out Omodoit — find skilled workers or grow your business in Nigeria. https://omoworkit.com',
      });
    } catch (err) {
      console.warn('Share failed:', err);
    }
  };

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(contentSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          Alert.alert('Contact Support', 'To delete your account, please email support@omoworkit.com with your request.');
        }},
      ]
    );
  };

  const accountSettings: SettingsItem[] = [
    { icon: '👤', label: 'Edit Profile', desc: 'Name, photo, location', action: () => navigation.navigate('EditProfile') },
    { icon: '🔒', label: 'Change Password', desc: 'Update your password', action: handleChangePassword },
    { icon: '📱', label: 'Phone Number', desc: profile?.phone || 'Not set', action: () => navigation.navigate('EditProfile') },
    { icon: '📧', label: 'Email', desc: user?.email || 'Not set' },
    { icon: '🔔', label: 'Notifications', desc: 'Push notification settings', action: () => navigation.navigate('Notifications') },
  ];

  const privacySettings: SettingsItem[] = [
    { icon: '🛡️', label: 'Privacy', desc: 'Control who sees your info', action: () => comingSoon('Privacy Settings') },
    { icon: '🚫', label: 'Blocked Users', desc: 'Manage blocked accounts', action: () => comingSoon('Blocked Users') },
    { icon: '📍', label: 'Location Settings', desc: 'GPS and tracking preferences', action: () => comingSoon('Location Settings') },
  ];

  const supportItems: SettingsItem[] = [
    { icon: '❓', label: 'Help Center', desc: 'FAQs and support', action: () => comingSoon('Help Center') },
    { icon: '💬', label: 'Contact Us', desc: 'Get in touch with our team', action: () => Linking.openURL('mailto:support@omoworkit.com') },
    { icon: '⭐', label: 'Rate Omodoit', desc: 'Love the app? Rate us!', action: () => comingSoon('Rate Omodoit') },
    { icon: '📣', label: 'Share Omodoit', desc: 'Tell your friends about us', action: handleShare },
  ];

  const legalItems: SettingsItem[] = [
    { icon: '📄', label: 'Terms of Use', desc: 'Our terms and conditions', action: () => Linking.openURL('https://omoworkit.com/Terms%20Of%20Use') },
    { icon: '🔐', label: 'Privacy Policy', desc: 'How we protect your data', action: () => Linking.openURL('https://omoworkit.com/Privacy%20Policy') },
  ];

  const renderSection = (title: string, items: SettingsItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.settingsCard}>
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.settingsRow}
            onPress={item.action}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsIcon}>{item.icon}</Text>
            <View style={styles.settingsInfo}>
              <Text style={[styles.settingsLabel, item.danger && { color: colors.error }]}>{item.label}</Text>
              <Text style={styles.settingsDesc}>{item.desc}</Text>
            </View>
            <Text style={styles.settingsArrow}>→</Text>
            {i < items.length - 1 && <View style={styles.settingsDivider} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
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
              <TouchableOpacity style={styles.settingsRow} onPress={handleLogout} activeOpacity={0.7}>
                <Text style={styles.settingsIcon}>🚪</Text>
                <View style={styles.settingsInfo}>
                  <Text style={[styles.settingsLabel, { color: colors.error }]}>Sign Out</Text>
                  <Text style={styles.settingsDesc}>Log out of your account</Text>
                </View>
                <Text style={[styles.settingsArrow, { color: colors.error }]}>→</Text>
              </TouchableOpacity>
              <View style={styles.settingsDivider} />
              <TouchableOpacity style={styles.settingsRow} onPress={handleDeleteAccount} activeOpacity={0.7}>
                <Text style={styles.settingsIcon}>⚠️</Text>
                <View style={styles.settingsInfo}>
                  <Text style={[styles.settingsLabel, { color: colors.error }]}>Delete Account</Text>
                  <Text style={styles.settingsDesc}>Permanently delete your account</Text>
                </View>
                <Text style={[styles.settingsArrow, { color: colors.error }]}>→</Text>
              </TouchableOpacity>
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
