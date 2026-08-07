import React, { useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, StatusBar, Platform, Alert, KeyboardAvoidingView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

const REEL_TYPES = [
  { key: 'showcase', icon: '🎬', label: 'Showcase', desc: 'Show your work and skills' },
  { key: 'tutorial', icon: '📚', label: 'Tutorial', desc: 'Teach something useful' },
  { key: 'promotion', icon: '📣', label: 'Promotion', desc: 'Promote a product or service' },
  { key: 'behind', icon: '🎭', label: 'Behind the Scenes', desc: 'Show your process' },
];

export default function CreateReelScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [videoUri, setVideoUri] = useState(null);
  const [videoThumb, setVideoThumb] = useState(null);
  const [description, setDescription] = useState('');
  const [reelType, setReelType] = useState('showcase');
  const [focused, setFocused] = useState('');
  const [publishing, setPublishing] = useState(false);

  const handleRecord = () => {
    Alert.alert(
      '🎥 Camera Access',
      'Camera access is needed to record your reel. This will be connected when the app is fully set up.',
      [{ text: 'OK' }]
    );
  };

  const handlePublish = () => {
    setPublishing(true);
    setTimeout(() => {
      setPublishing(false);
      Alert.alert(
        '🎉 Reel Published!',
        'Your reel is now live. Clients can discover you through it.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }, 1000);
  };

  return (
    <KeyboardAvoidingView style={[st.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={st.backText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Create Reel</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}>

        {/* Video upload area */}
        <TouchableOpacity style={st.videoUpload} onPress={handleRecord} activeOpacity={0.85}>
          <View style={st.videoUploadCircle}>
            <Text style={st.videoUploadIcon}>🎥</Text>
          </View>
          <Text style={st.videoUploadTitle}>Record or Upload Video</Text>
          <Text style={st.videoUploadSub}>Max 60 seconds · Portrait mode recommended</Text>
          <View style={st.videoUploadBtns}>
            <View style={st.videoOptionBtn}>
              <Text style={st.videoOptionIcon}>📷</Text>
              <Text style={st.videoOptionText}>Record</Text>
            </View>
            <View style={st.videoOptionBtn}>
              <Text style={st.videoOptionIcon}>📁</Text>
              <Text style={st.videoOptionText}>Upload</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={st.form}>
          {/* Reel Type */}
          <Text style={st.sectionTitle}>Reel Type</Text>
          <View style={st.typeGrid}>
            {REEL_TYPES.map(type => (
              <TouchableOpacity key={type.key}
                style={[st.typeCard, reelType === type.key && st.typeCardActive]}
                onPress={() => setReelType(type.key)} activeOpacity={0.85}>
                <Text style={st.typeIcon}>{type.icon}</Text>
                <Text style={[st.typeLabel, reelType === type.key && st.typeLabelActive]}>{type.label}</Text>
                <Text style={st.typeDesc}>{type.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={st.sectionTitle}>Description</Text>
          <TextInput style={[st.textArea, focused === 'desc' && st.inputFocused]}
            value={description} onChangeText={setDescription}
            placeholder="Describe your reel... Add hashtags to get discovered!"
            placeholderTextColor={colors.textMuted} multiline numberOfLines={4}
            textAlignVertical="top" maxLength={300}
            onFocus={() => setFocused('desc')} onBlur={() => setFocused('')} />
          <Text style={st.charCount}>{description.length}/300</Text>

          {/* Tips */}
          <View style={st.tipsCard}>
            <Text style={st.tipsTitle}>💡 Tips for great reels</Text>
            <Text style={st.tipItem}>• Show your actual work, not stock footage</Text>
            <Text style={st.tipItem}>• Keep it under 30 seconds for best engagement</Text>
            <Text style={st.tipItem}>• Film in good lighting and portrait mode</Text>
            <Text style={st.tipItem}>• Add a description with relevant hashtags</Text>
            <Text style={st.tipItem}>• Show before and after for maximum impact</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[st.bottomBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16 }]}>
        <TouchableOpacity style={st.publishBtn} onPress={handlePublish} activeOpacity={0.85}>
          <Text style={st.publishBtnText}>{publishing ? 'Publishing...' : '🚀 Publish Reel'}</Text>
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

  videoPreview: { margin: spacing.screenPadding, height: 220, backgroundColor: colors.primary + '15', borderRadius: 16, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  videoPreviewOverlay: { alignItems: 'center' },
  videoPreviewIcon: { fontSize: 32, color: colors.primary, marginBottom: 8 },
  videoPreviewText: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  videoPreviewChange: { fontSize: 11, color: colors.textMuted },
  videoUpload: { margin: spacing.screenPadding, height: 220, backgroundColor: '#111', borderRadius: 16, borderWidth: 2, borderColor: colors.primary + '30', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  videoUploadCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  videoUploadIcon: { fontSize: 28 },
  videoUploadTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  videoUploadSub: { fontSize: 11, color: colors.textMuted, marginBottom: 16 },
  videoUploadBtns: { flexDirection: 'row', gap: 12 },
  videoOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgCard, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 8 },
  videoOptionIcon: { fontSize: 14 },
  videoOptionText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },

  form: { paddingHorizontal: spacing.screenPadding },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeCard: { width: '48%', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  typeCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  typeIcon: { fontSize: 22, marginBottom: 6 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  typeLabelActive: { color: colors.primary },
  typeDesc: { fontSize: 10, color: colors.textMuted, lineHeight: 14 },

  textArea: { backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontSize: 14, color: colors.textPrimary, minHeight: 80 },
  inputFocused: { borderColor: colors.primary + '50' },
  charCount: { fontSize: 10, color: colors.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 16 },

  tipsCard: { backgroundColor: colors.primary + '08', borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '20', padding: 16 },
  tipsTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 10 },
  tipItem: { fontSize: 11, color: colors.textSecondary, lineHeight: 20, paddingLeft: 4 },

  bottomBar: { paddingHorizontal: spacing.screenPadding, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  publishBtn: { height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  publishBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
