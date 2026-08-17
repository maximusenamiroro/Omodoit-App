import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, Animated, StatusBar, Platform, Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

export default function HireWorkerScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { worker, subcategoryName } = route.params;

  const [jobDescription, setJobDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [focused, setFocused] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(formSlide, { toValue: 0, damping: 16, stiffness: 90, useNativeDriver: true }),
      ]),
    ]).start();
  }, [formOpacity, formSlide, headerOpacity]);

  const isFormValid = () => {
    return jobDescription.trim().length >= 10 && location.trim().length >= 3;
  };

  const handleBooking = async () => {
    if (!isFormValid()) {
      Alert.alert('Complete the Form', 'Please describe the job and enter your location');
      return;
    }
    if (!user?.id) {
      Alert.alert('Please Log In', 'You need to be logged in to book a worker.');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      // hire_requests only has job_description/location as free-text
      // fields — fold the optional date/time/budget into the
      // description itself, clearly labeled, so nothing the client
      // typed gets silently dropped.
      let fullDescription = jobDescription.trim();
      const extras: string[] = [];
      if (date.trim()) extras.push(`Preferred date: ${date.trim()}`);
      if (time.trim()) extras.push(`Preferred time: ${time.trim()}`);
      if (budget.trim()) extras.push(`Budget: ₦${budget.trim()}`);
      if (extras.length > 0) fullDescription += '\n\n' + extras.join('\n');

      const { error } = await supabase.from('hire_requests').insert({
        client_id: user.id,
        worker_id: worker.id,
        job_description: fullDescription,
        location: location.trim(),
        status: 'pending',
      });

      if (error) throw error;

      // No notification is inserted here on purpose. The on_booking
      // trigger fires on every hire_requests insert and writes one
      // itself, so doing it here as well put two entries in the worker's
      // feed for a single booking.

      Alert.alert(
        'Booking Sent!',
        worker.name + ' will be notified of your booking request. They will respond shortly.',
        [{ text: 'OK', onPress: () => navigation.popToTop() }]
      );
    } catch (err: any) {
      console.error('Booking submission error:', err);
      Alert.alert(
        'Could Not Send Booking',
        'Something went wrong sending your request. Please check your connection and try again.'
      );
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

      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </PressableScale>
        <Text style={styles.headerTitle}>Book Worker</Text>
        <View style={{ width: 36 }} />
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }} keyboardShouldPersistTaps="handled">
        {/* Worker info card */}
        <Animated.View style={[styles.workerCard, { opacity: headerOpacity }]}>
          <View style={[styles.workerAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.workerAvatarText}>{getInitials(worker.name)}</Text>
          </View>
          <View style={styles.workerInfo}>
            <Text style={styles.workerName}>{worker.name}</Text>
            <Text style={styles.workerCategory}>{subcategoryName}</Text>
            <View style={styles.workerRating}>
              <Text style={styles.starIcon}>⭐</Text>
              <Text style={styles.ratingText}>{worker.rating} ({worker.reviews} reviews)</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: formOpacity, transform: [{ translateY: formSlide }], paddingHorizontal: spacing.screenPadding }}>
          {/* Job description */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>What do you need done? *</Text>
            <TextInput
              style={[styles.textArea, focused === 'desc' && styles.inputFocused]}
              value={jobDescription}
              onChangeText={setJobDescription}
              placeholder="Describe the job in detail — what needs to be fixed, installed, or done..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
              onFocus={() => setFocused('desc')}
              onBlur={() => setFocused('')}
            />
            <Text style={styles.charCount}>{jobDescription.length}/500</Text>
          </View>

          {/* Location */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Job Location *</Text>
            <TextInput
              style={[styles.input, focused === 'loc' && styles.inputFocused]}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. 15 Allen Avenue, Ikeja, Lagos"
              placeholderTextColor={colors.textMuted}
              onFocus={() => setFocused('loc')}
              onBlur={() => setFocused('')}
            />
          </View>

          {/* Date and Time row */}
          <View style={styles.row}>
            <View style={[styles.fieldContainer, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Preferred Date</Text>
              <TextInput
                style={[styles.input, focused === 'date' && styles.inputFocused]}
                value={date}
                onChangeText={setDate}
                placeholder="e.g. Tomorrow"
                placeholderTextColor={colors.textMuted}
                onFocus={() => setFocused('date')}
                onBlur={() => setFocused('')}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.fieldContainer, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Preferred Time</Text>
              <TextInput
                style={[styles.input, focused === 'time' && styles.inputFocused]}
                value={time}
                onChangeText={setTime}
                placeholder="e.g. 10:00 AM"
                placeholderTextColor={colors.textMuted}
                onFocus={() => setFocused('time')}
                onBlur={() => setFocused('')}
              />
            </View>
          </View>

          {/* Budget */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Your Budget (optional)</Text>
            <View style={[styles.budgetRow, focused === 'budget' && styles.inputFocused]}>
              <Text style={styles.nairaSign}>₦</Text>
              <TextInput
                style={styles.budgetInput}
                value={budget}
                onChangeText={setBudget}
                placeholder="e.g. 15,000"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                onFocus={() => setFocused('budget')}
                onBlur={() => setFocused('')}
              />
            </View>
            <Text style={styles.fieldHint}>Leave empty if you want the worker to quote</Text>
          </View>

          {/* Info card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>How booking works</Text>
              <Text style={styles.infoText}>1. Submit your request{'\n'}2. {worker.name} reviews and accepts{'\n'}3. Agree on final price{'\n'}4. Worker arrives and starts work{'\n'}5. Pay after the job is done</Text>
            </View>
          </View>

          {/* Commission note */}
          <View style={styles.commissionNote}>
            <Text style={styles.commissionIcon}>💰</Text>
            <Text style={styles.commissionText}>Omodoit takes 0% commission — the full amount goes to the worker</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom */}
      <View style={[styles.bottomBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16 }]}>
        <PressableScale
          style={[styles.submitBtn, (!isFormValid() || submitting) && styles.submitBtnDisabled]}
          onPress={handleBooking}
          disabled={!isFormValid() || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Sending…' : 'Send Booking Request'}</Text>
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

  workerCard: { flexDirection: 'row', alignItems: 'center', margin: spacing.screenPadding, backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  workerAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  workerAvatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  workerInfo: { flex: 1 },
  workerName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  workerCategory: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  workerRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starIcon: { fontSize: 11 },
  ratingText: { fontSize: 11, color: colors.textSecondary },

  fieldContainer: { marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  input: { height: 48, backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, fontSize: 14, color: colors.textPrimary },
  inputFocused: { borderColor: colors.client + '50' },
  textArea: { backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontSize: 14, color: colors.textPrimary, minHeight: 100 },
  charCount: { fontSize: 10, color: colors.textMuted, textAlign: 'right', marginTop: 4 },
  row: { flexDirection: 'row' },
  budgetRow: { flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16 },
  nairaSign: { fontSize: 16, fontWeight: '700', color: colors.primary, marginRight: 8 },
  budgetInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  fieldHint: { fontSize: 10, color: colors.textMuted, marginTop: 4 },

  infoCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 14 },
  infoIcon: { fontSize: 16, marginRight: 12, marginTop: 2 },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  infoText: { fontSize: 11, color: colors.textMuted, lineHeight: 18 },

  commissionNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '10', borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '25', padding: 12, marginBottom: 16 },
  commissionIcon: { fontSize: 16, marginRight: 10 },
  commissionText: { flex: 1, fontSize: 11, color: colors.primary, fontWeight: '500' },

  bottomBar: { paddingHorizontal: spacing.screenPadding, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  submitBtn: { height: 52, borderRadius: 14, backgroundColor: colors.client, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  submitText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
