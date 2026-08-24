import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  StatusBar, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import Icon from '../../components/common/Icon';
import PressableScale from '../../components/common/PressableScale';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';

export default function LeaveReviewScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { workerId, workerName } = route.params;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Add a Rating', 'Tap a star to rate this worker.');
      return;
    }
    if (!user?.id) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        worker_id: workerId,
        client_id: user.id,
        rating,
        comment: comment.trim() || null,
      });

      if (error) throw error;

      Alert.alert('Thank You!', 'Your review has been posted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('Review submission error:', err);
      Alert.alert('Could Not Post Review', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.header}>
        <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="back" size={20} color={colors.white} />
        </PressableScale>
        <Text style={styles.headerTitle}>Leave a Review</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.prompt}>How was your experience with</Text>
        <Text style={styles.workerName}>{workerName}?</Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <PressableScale key={n} onPress={() => setRating(n)}>
              <Text style={[styles.star, n <= rating && styles.starFilled]}>⭐</Text>
            </PressableScale>
          ))}
        </View>

        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder="Tell others about your experience (optional)"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={300}
        />

        <PressableScale
          style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Posting…' : 'Post Review'}</Text>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  content: { flex: 1, paddingHorizontal: spacing.screenPadding, paddingTop: 32 },
  prompt: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  workerName: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 24 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 28 },
  star: { fontSize: 36, opacity: 0.25 },
  starFilled: { opacity: 1 },
  commentInput: { backgroundColor: colors.bgInput, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, padding: 16, fontSize: 14, color: colors.textPrimary, minHeight: 110, marginBottom: 24 },
  submitBtn: { height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  submitText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
