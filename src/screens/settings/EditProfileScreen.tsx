import React, { useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, StatusBar, Platform, Alert, KeyboardAvoidingView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import { uploadImageToStorage, clearOldUploads } from '../../lib/uploadImage';

export default function EditProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, profile, role, refreshProfile } = useAuth();
  const accentColor = role === 'client' ? colors.client : colors.primary;

  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);
  const [newAvatarPicked, setNewAvatarPicked] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [experience, setExperience] = useState(profile?.experience || '');
  const [serviceArea, setServiceArea] = useState(profile?.service_area || '');
  const [focused, setFocused] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name Required', 'Please enter your full name');
      return;
    }
    if (!user?.id) return;
    if (saving) return;

    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url || null;
      if (newAvatarPicked && avatarUri) {
        await clearOldUploads('avatars', user.id);
        avatarUrl = await uploadImageToStorage('avatars', avatarUri, user.id);
      }

      const updates: Record<string, any> = {
        full_name: fullName.trim(),
        location: location.trim() || null,
        phone: phone.trim() || null,
        avatar_url: avatarUrl,
      };

      if (role === 'worker') {
        updates.business_name = businessName.trim() || null;
        updates.experience = experience.trim() || null;
        updates.service_area = serviceArea.trim() || null;
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;

      // Refresh AuthContext's cached profile so the rest of the app
      // (including this screen if reopened) reflects the change
      // immediately instead of waiting for the next natural refetch.
      await refreshProfile();

      Alert.alert('Profile Updated', 'Your changes have been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      console.error('Profile save error:', err);
      Alert.alert('Could Not Save', 'Something went wrong. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (label: string, value: string, setter: (v: string) => void, placeholder: string, key: string, options: any = {}) => (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        style={[st.input, focused === key && [st.inputFocused, { borderColor: accentColor + '50' }]]}
        value={value} onChangeText={setter} placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={options.keyboard || 'default'}
        onFocus={() => setFocused(key)} onBlur={() => setFocused('')}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={[st.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={st.backText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.7}>
          <Text style={[st.saveHeaderText, { color: accentColor }]}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}>

        {/* Avatar */}
        <View style={st.avatarSection}>
          <View style={[st.avatarRing, { borderColor: accentColor }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={st.avatarImg} />
            ) : (
              <View style={[st.avatar, { backgroundColor: accentColor }]}>
                <Text style={st.avatarText}>
                  {fullName ? fullName.trim().split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={[st.changePhotoBtn, { backgroundColor: accentColor }]} onPress={() => {
            launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 800, maxHeight: 800 }, (res) => {
              const uri = res.assets?.[0]?.uri;
              if (uri) {
                setAvatarUri(uri);
                setNewAvatarPicked(true);
              }
            });
          }} activeOpacity={0.85}>
            <Text style={st.changePhotoText}>📷 Change Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={st.form}>
          {renderField('Full Name *', fullName, setFullName, 'Your full name', 'name')}
          {renderField('Location', location, setLocation, 'City, State e.g. Lagos, Nigeria', 'loc')}
          {renderField('Phone Number', phone, setPhone, '+234...', 'phone', { keyboard: 'phone-pad' })}

          {role === 'worker' && (
            <>
              <View style={st.divider} />
              <Text style={st.sectionLabel}>🛠️ Business Details</Text>
              {renderField('Business Name', businessName, setBusinessName, 'Your business or brand name', 'biz')}
              {renderField('Experience', experience, setExperience, 'e.g. 5-10 years', 'exp')}
              {renderField('Service Area', serviceArea, setServiceArea, 'e.g. Ikeja, Lekki, VI', 'area')}
            </>
          )}
        </View>
      </ScrollView>

      <View style={[st.bottomBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16 }]}>
        <TouchableOpacity style={[st.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.6 }]}
          onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <Text style={st.saveBtnText}>{saving ? 'Saving...' : '✓ Save Changes'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  saveHeaderText: { fontSize: 14, fontWeight: '700' },

  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 84, height: 84, borderRadius: 42 },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#fff' },
  changePhotoBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
  changePhotoText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  form: { paddingHorizontal: spacing.screenPadding },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  input: { height: 48, backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, fontSize: 14, color: colors.textPrimary },
  inputFocused: { borderWidth: 1.5 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },

  bottomBar: { paddingHorizontal: spacing.screenPadding, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  saveBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
