import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from '../../components/common/PressableScale';
import Avatar from '../../components/common/Avatar';
import Icon from '../../components/common/Icon';
import { colors, spacing } from '../../theme';
import { blockedUsersWithProfiles, unblockUser, type BlockedUser } from '../../lib/moderation';

// The block list.
//
// This row already existed in Settings and called comingSoon(), which
// is worse than not having it: Apple's Guideline 1.2 requires a working
// way to block abusive users, and a stub advertises the feature while
// leaving people with no way to undo a block they regret.
//
// Unblocking is deliberately a confirmation rather than a swipe. People
// block someone in a bad moment and open this screen to check who is on
// the list, and an accidental swipe silently letting someone back in is
// the one mistake this screen must not make easy.

export default function BlockedUsersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setUsers(await blockedUsersWithProfiles());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmUnblock = (u: BlockedUser) => {
    Alert.alert(
      `Unblock ${u.name}?`,
      'They will be able to message you again, and their posts will come back to your feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setBusyId(u.id);
            const ok = await unblockUser(u.id);
            setBusyId(null);
            if (!ok) { Alert.alert('Could not unblock', 'Please try again.'); return; }
            // Removed locally rather than refetching: the answer is
            // already known and a round trip here would leave the row
            // sitting there looking like nothing happened.
            setUsers(prev => prev.filter(x => x.id !== u.id));
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale style={styles.back} accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.title}>Blocked Users</Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🚫</Text>
          <Text style={styles.emptyTitle}>You haven't blocked anyone</Text>
          <Text style={styles.emptySub}>
            You can block someone from the Report option on any reel or profile.
            Blocked people can't message you and won't appear in your feed.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar uri={item.avatarUrl} name={item.name} size={44} />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {!!item.category && <Text style={styles.meta} numberOfLines={1}>{item.category}</Text>}
              </View>
              <PressableScale
                style={styles.unblock}
                onPress={() => confirmUnblock(item)}
                disabled={busyId === item.id}
              >
                {busyId === item.id
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={styles.unblockText}>Unblock</Text>}
              </PressableScale>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  emptySub: {
    fontSize: 13, color: colors.textSecondary, textAlign: 'center',
    marginTop: 8, lineHeight: 19,
  },
  list: { padding: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: 14,
    padding: 12, marginBottom: 8,
  },
  info: { flex: 1, marginLeft: 12, marginRight: 10 },
  name: { fontSize: 14.5, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  unblock: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.primary + '50',
    backgroundColor: colors.primary + '15', minWidth: 82, alignItems: 'center',
  },
  unblockText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
});
