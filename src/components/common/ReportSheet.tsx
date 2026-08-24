import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from './PressableScale';
import { colors, spacing } from '../../theme';
import {
  REPORT_REASONS, blockUser, reportContent,
  type ReportReason, type ReportTargetType,
} from '../../lib/moderation';

// The report sheet.
//
// Apple 1.2 and Google's UGC policy require a way to report content and
// a way to block the person who posted it. Those two belong in the same
// place: someone who has just seen something they want gone usually
// wants both, and making them hunt for the block control separately is
// how people give up and uninstall instead.
//
// Reporting does not delete anything on the spot. It cannot — one
// person's report is not a moderation decision, and letting a report
// remove a video would hand every user a takedown button to aim at
// competitors. Blocking is the instant remedy, so the sheet offers it
// alongside and applies it immediately.

interface Props {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId?: string | null;
  /** Shown in the confirmation, so the user is sure who they blocked. */
  targetOwnerName?: string | null;
  /** Called after a successful block so the caller can drop the content. */
  onBlocked?: (userId: string) => void;
}

export default function ReportSheet({
  visible, onClose, targetType, targetId,
  targetOwnerId, targetOwnerName, onBlocked,
}: Props) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setReason(null); setDetails(''); setBusy(false); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    const outcome = await reportContent({
      targetType, targetId, targetOwnerId, reason, details,
    });
    setBusy(false);

    if (outcome === 'failed') {
      Alert.alert('Could not send report', 'Please check your connection and try again.');
      return;
    }
    close();
    Alert.alert(
      outcome === 'already-reported' ? 'Already reported' : 'Thank you',
      outcome === 'already-reported'
        ? 'You have already reported this. Our team is looking at it.'
        : 'Our team reviews reports within 24 hours. You can also block this person so you stop seeing their posts.',
    );
  };

  const confirmBlock = () => {
    if (!targetOwnerId) return;
    Alert.alert(
      `Block ${targetOwnerName || 'this user'}?`,
      'You will stop seeing their reels and they will not be able to message you. You can undo this in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const ok = await blockUser(targetOwnerId);
            setBusy(false);
            if (!ok) {
              Alert.alert('Could not block', 'Please try again.');
              return;
            }
            close();
            onBlocked?.(targetOwnerId);
            Alert.alert('Blocked', `You will no longer see posts from ${targetOwnerName || 'this user'}.`);
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={close}>
      <View style={styles.overlay}>
        {/* Plain Pressable, not PressableScale: this is an invisible
            backdrop, and animating a scale on something with nothing to
            look at is motion for its own sake. */}
        <Pressable style={styles.dismiss} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Report this {targetType}</Text>
          <Text style={styles.subtitle}>
            Tell us what is wrong. Reports are anonymous — the person you report is not told who reported them.
          </Text>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {REPORT_REASONS.map(r => {
              const selected = reason === r.value;
              return (
                <PressableScale
                  key={r.value}
                  style={[styles.reason, selected && styles.reasonOn]}
                  onPress={() => setReason(r.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                  <View style={styles.reasonText}>
                    <Text style={[styles.reasonLabel, selected && styles.reasonLabelOn]}>{r.label}</Text>
                    <Text style={styles.reasonHint}>{r.hint}</Text>
                  </View>
                </PressableScale>
              );
            })}

            {reason === 'other' && (
              <TextInput
                style={styles.input}
                value={details}
                onChangeText={setDetails}
                placeholder="What is wrong with this?"
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={1000}
              />
            )}
          </ScrollView>

          <PressableScale
            style={[styles.submit, (!reason || busy) && styles.submitOff]}
            onPress={submit}
            disabled={!reason || busy}
          >
            {busy ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.submitText}>Send report</Text>}
          </PressableScale>

          {!!targetOwnerId && (
            <PressableScale style={styles.block} onPress={confirmBlock} disabled={busy}>
              <Text style={styles.blockText}>Block {targetOwnerName || 'this user'}</Text>
            </PressableScale>
          )}

          <PressableScale style={styles.cancel} onPress={close}>
            <Text style={styles.cancelText}>Cancel</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: spacing.md, paddingTop: 10, maxHeight: '86%',
  },
  handle: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: colors.white + '25', marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, textTransform: 'capitalize' },
  subtitle: { fontSize: 12.5, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
  list: { marginTop: 14 },
  reason: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 6,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: 'transparent',
  },
  reasonOn: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  radio: {
    width: 19, height: 19, borderRadius: 10, borderWidth: 2,
    borderColor: colors.textSecondary, marginRight: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  reasonText: { flex: 1 },
  reasonLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  reasonLabelOn: { color: colors.primary },
  reasonHint: { fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  input: {
    backgroundColor: colors.bgCard, borderRadius: 12, padding: 12,
    color: colors.textPrimary, fontSize: 14, minHeight: 84,
    textAlignVertical: 'top', marginTop: 4, marginBottom: 8,
  },
  submit: {
    backgroundColor: colors.primary, borderRadius: 999,
    paddingVertical: 14, alignItems: 'center', marginTop: 12,
  },
  submitOff: { opacity: 0.45 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  block: { paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  blockText: { color: colors.error, fontWeight: '700', fontSize: 14 },
  cancel: { paddingVertical: 11, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
