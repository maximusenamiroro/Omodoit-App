import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';
import Skeleton from './Skeleton';

// The loading shape for BookingCard and OrderCard, which share a layout:
// a square-ish thumbnail or avatar, three stacked lines of decreasing
// width, a status pill, and a row of actions underneath.
//
// The measurements deliberately match the real cards. A skeleton that is
// merely "some grey boxes" still causes the jump it was meant to
// prevent, because the content lands somewhere the placeholder never
// suggested. These sit where the real thing sits.

interface Props {
  count?: number;
  /** Rows that carry buttons underneath. Off for plain list rows. */
  actions?: boolean;
}

export default function CardRowSkeleton({ count = 4, actions = true }: Props) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={st.card}>
          <View style={st.top}>
            <Skeleton width={46} height={46} radius={12} style={st.thumb} />
            <View style={st.info}>
              <Skeleton width="55%" height={13} />
              <Skeleton width="35%" height={11} style={st.gap} />
              <Skeleton width="45%" height={10} style={st.gapSmall} />
            </View>
            <Skeleton width={62} height={20} radius={8} style={st.badge} />
          </View>
          {actions && (
            <View style={st.actions}>
              <Skeleton height={38} radius={10} style={st.action} />
              <Skeleton height={38} radius={10} style={st.action} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  top: { flexDirection: 'row', alignItems: 'center' },
  thumb: { marginRight: 12 },
  info: { flex: 1 },
  gap: { marginTop: 8 },
  gapSmall: { marginTop: 7 },
  badge: { marginLeft: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { flex: 1 },
});
