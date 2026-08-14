import React, { useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, StatusBar, Platform, Alert, KeyboardAvoidingView, Image, } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { uploadImageToStorage } from '../../lib/uploadImage';

const PRODUCT_CATEGORIES = [
  'Service', 'Physical Product', 'Digital Product', 'Consultation',
  'Repair', 'Installation', 'Training', 'Other',
];

export default function AddProductScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [focused, setFocused] = useState('');
  const [publishing, setPublishing] = useState(false);

  const isValid = title.trim().length >= 3 && price.trim().length > 0 && category.length > 0;

  const handlePublish = async () => {
    if (!isValid) {
      Alert.alert('Complete the Form', 'Please fill in title, price, and category');
      return;
    }
    if (!user?.id) {
      Alert.alert('Please Log In', 'You need to be logged in to publish a product.');
      return;
    }
    if (publishing) return;

    setPublishing(true);
    try {
      // Upload the first photo only for now — products table has a
      // single image_url column, not a gallery. Additional photos the
      // user picked stay local and aren't saved; a multi-image gallery
      // would need a schema change (a separate product_images table).
      let imageUrl: string | null = null;
      if (photos.length > 0) {
        imageUrl = await uploadImageToStorage('products', photos[0], user.id);
      }

      const numericPrice = Number(price.replace(/,/g, ''));

      const { error } = await supabase.from('products').insert({
        worker_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        price: isNaN(numericPrice) ? null : numericPrice,
        category,
        image_url: imageUrl,
      });

      if (error) throw error;

      Alert.alert(
        '🎉 Product Published!',
        title + ' is now live. Clients can see it on your profile.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      console.error('Product publish error:', err);
      Alert.alert('Could Not Publish', 'Something went wrong. Please check your connection and try again.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[st.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={st.backText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Add Product</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}>

        {/* Image upload area */}
        <View style={st.photosSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.photosScroll}>
            {photos.map((uri, i) => (
              <View key={i} style={st.photoThumb}>
                <Image source={{ uri }} style={st.photoImg} />
                <TouchableOpacity style={st.photoRemove} onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                  <Text style={st.photoRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={st.photoAdd} onPress={() => {
                launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 1200 }, (res) => {
                  if (res.assets && res.assets[0]?.uri) {
                    const uri = res.assets[0].uri;
                    setPhotos(prev => [...prev, uri].slice(0, 5));
                  }
                });
              }} activeOpacity={0.85}>
                <Text style={st.photoAddIcon}>📷</Text>
                <Text style={st.photoAddText}>{photos.length}/5</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <View style={st.form}>
          {/* Title */}
          <View style={st.field}>
            <Text style={st.label}>Product Title *</Text>
            <TextInput style={[st.input, focused === 'title' && st.inputFocused]}
              value={title} onChangeText={setTitle} placeholder="e.g. AC Servicing, Hair Braiding..."
              placeholderTextColor={colors.textMuted} maxLength={100}
              onFocus={() => setFocused('title')} onBlur={() => setFocused('')} />
          </View>

          {/* Description */}
          <View style={st.field}>
            <Text style={st.label}>Description</Text>
            <TextInput style={[st.textArea, focused === 'desc' && st.inputFocused]}
              value={description} onChangeText={setDescription}
              placeholder="Describe what you offer, what's included, delivery time..."
              placeholderTextColor={colors.textMuted} multiline numberOfLines={4}
              textAlignVertical="top" maxLength={500}
              onFocus={() => setFocused('desc')} onBlur={() => setFocused('')} />
            <Text style={st.charCount}>{description.length}/500</Text>
          </View>

          {/* Price */}
          <View style={st.field}>
            <Text style={st.label}>Price *</Text>
            <View style={[st.priceRow, focused === 'price' && st.inputFocused]}>
              <Text style={st.naira}>₦</Text>
              <TextInput style={st.priceInput}
                value={price} onChangeText={setPrice} placeholder="e.g. 15,000"
                placeholderTextColor={colors.textMuted} keyboardType="numeric"
                onFocus={() => setFocused('price')} onBlur={() => setFocused('')} />
            </View>
          </View>

          {/* Category */}
          <View style={st.field}>
            <Text style={st.label}>Category *</Text>
            <View style={st.catGrid}>
              {PRODUCT_CATEGORIES.map(cat => (
                <TouchableOpacity key={cat}
                  style={[st.catChip, category === cat && st.catChipActive]}
                  onPress={() => setCategory(cat)} activeOpacity={0.85}>
                  <Text style={[st.catChipText, category === cat && st.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Commission note */}
          <View style={st.commNote}>
            <Text style={st.commIcon}>💰</Text>
            <Text style={st.commText}>0% commission — you keep 100% of every sale</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[st.bottomBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16 }]}>
        <TouchableOpacity style={[st.publishBtn, !isValid && st.publishBtnDisabled, publishing && { opacity: 0.6 }]}
          onPress={handlePublish} disabled={!isValid || publishing} activeOpacity={0.85}>
          <Text style={st.publishBtnText}>{publishing ? 'Publishing...' : '🚀 Publish Product'}</Text>
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

  photosSection: { marginHorizontal: spacing.screenPadding, marginBottom: 16 },
  photosScroll: { gap: 10 },
  photoThumb: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  photoRemoveText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  photoAdd: { width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderColor: colors.primary + '30', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgCard },
  photoAddIcon: { fontSize: 24, marginBottom: 4 },
  photoAddText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  imageUpload_unused: { margin: spacing.screenPadding, height: 160, backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 2, borderColor: colors.primary + '30', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  imageUploadIcon: { fontSize: 36, marginBottom: 8, opacity: 0.5 },
  imageUploadTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  imageUploadSub: { fontSize: 11, color: colors.textMuted },

  form: { paddingHorizontal: spacing.screenPadding },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  input: { height: 48, backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, fontSize: 14, color: colors.textPrimary },
  inputFocused: { borderColor: colors.primary + '50' },
  textArea: { backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontSize: 14, color: colors.textPrimary, minHeight: 100 },
  charCount: { fontSize: 10, color: colors.textMuted, textAlign: 'right', marginTop: 4 },

  priceRow: { flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16 },
  naira: { fontSize: 18, fontWeight: '700', color: colors.primary, marginRight: 8 },
  priceInput: { flex: 1, fontSize: 14, color: colors.textPrimary },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  catChipTextActive: { color: '#fff', fontWeight: '700' },

  commNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '10', borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '25', padding: 14, gap: 10 },
  commIcon: { fontSize: 18 },
  commText: { flex: 1, fontSize: 11, color: colors.primary, fontWeight: '500' },

  bottomBar: { paddingHorizontal: spacing.screenPadding, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  publishBtn: { height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  publishBtnDisabled: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  publishBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
