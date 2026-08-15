import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, StatusBar, Animated, Platform, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';

const getInitials = (name: string | null): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

const formatTime = (date: string): string => {
  const now = new Date();
  const msgDate = new Date(date);
  const diffMs = now.getTime() - msgDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return diffMins + 'm';
  if (diffHours < 24) return diffHours + 'h';
  if (diffDays < 7) return diffDays + 'd';
  return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCallDuration = (seconds: number): string => {
  if (seconds < 60) return seconds + 's';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + 'm' + (s > 0 ? ' ' + s + 's' : '');
};

interface Conversation {
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  otherUserRole: string | null;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageType: string;
  unreadCount: number;
  isLastMessageMine: boolean;
}

interface CallLogItem {
  id: string;
  otherUserId: string;
  otherUserName: string;
  status: 'completed' | 'declined' | 'missed' | 'cancelled';
  wasOutgoing: boolean;
  durationSeconds: number;
  time: string;
}

// One screenful of conversations. The list is ordered by recency, so
// anyone you are actually talking to is on the first page.
const CONVERSATION_PAGE_SIZE = 30;

export default function InboxScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // The magnifier in the header used to be decorative. Filtering happens
  // on the already-loaded list rather than in a query: a conversation
  // list is small, and a local filter answers on every keystroke with
  // no round trip and no spinner.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(listOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [headerOpacity, listOpacity]);


  const fetchCallLogs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: rows, error } = await supabase
        .from('call_logs')
        .select('id, caller_id, callee_id, status, duration_seconds, created_at')
        .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const otherIds = [...new Set((rows || []).map((r: any) =>
        r.caller_id === user.id ? r.callee_id : r.caller_id
      ))];
      let nameMap: Record<string, string> = {};
      if (otherIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', otherIds);
        (profileRows || []).forEach((p: any) => { nameMap[p.id] = p.full_name || 'User'; });
      }

      setCallLogs((rows || []).map((r: any) => ({
        id: r.id,
        otherUserId: r.caller_id === user.id ? r.callee_id : r.caller_id,
        otherUserName: nameMap[r.caller_id === user.id ? r.callee_id : r.caller_id] || 'User',
        status: r.status,
        wasOutgoing: r.caller_id === user.id,
        durationSeconds: r.duration_seconds || 0,
        time: formatTime(r.created_at),
      })));
    } catch (err) {
      console.warn('Could not load call logs (non-fatal):', err);
      setCallLogs([]);
    }
  }, [user?.id]);

  const channelRef = useRef<any>(null);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      // One row per conversation, built by Postgres. This used to fetch
      // every message the user had ever exchanged and group them here —
      // 10,000 rows over a phone connection to draw 50 lines.
      const { data, error } = await supabase.rpc('get_conversations', {
        p_limit: CONVERSATION_PAGE_SIZE,
        p_offset: 0,
      });

      if (error) throw error;

      setConversations((data || []).map((row: any) => {
        let preview = row.last_message || '';
        if (row.last_message_type === 'image') preview = '📷 Photo';
        if (row.last_message_type === 'video') preview = '🎥 Video';
        if (row.last_message_type === 'audio') preview = '🎤 Voice message';
        if (row.last_message_type === 'file') preview = '📎 File';

        return {
          otherUserId: row.other_user_id,
          otherUserName: row.other_user_name || 'User',
          otherUserAvatar: row.other_user_avatar || null,
          otherUserRole: row.other_user_role || null,
          lastMessage: preview,
          lastMessageTime: row.last_message_at,
          lastMessageType: row.last_message_type || 'text',
          unreadCount: Number(row.unread_count) || 0,
          isLastMessageMine: row.last_sender_id === user.id,
        };
      }));
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const setupRealtime = useCallback(() => {
    if (!user?.id) return;
    channelRef.current = supabase
      .channel('inbox_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload: any) => {
        const msg = payload.new;
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          fetchConversations();
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_logs',
      }, (payload: any) => {
        const log = payload.new;
        if (log.caller_id === user.id || log.callee_id === user.id) {
          fetchCallLogs();
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user?.id, fetchConversations, fetchCallLogs]);

  useEffect(() => {
    if (user?.id) {
      fetchConversations();
      fetchCallLogs();
      setupRealtime();
    }
  }, [user?.id, fetchConversations, fetchCallLogs, setupRealtime]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const openChat = (conv: Conversation) => {
    navigation.navigate('Chat', {
      otherUserId: conv.otherUserId,
      otherUserName: conv.otherUserName,
      otherUserAvatar: conv.otherUserAvatar,
    });
  };

  const accentColor = role === 'client' ? colors.client : colors.primary;

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.convRow}
      onPress={() => openChat(item)}
      activeOpacity={0.7}
    >
      {item.otherUserAvatar ? (
        <Image source={{ uri: item.otherUserAvatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: accentColor }]}>
          <Text style={styles.avatarText}>{getInitials(item.otherUserName)}</Text>
        </View>
      )}

      <View style={styles.convInfo}>
        <View style={styles.convTopRow}>
          <Text style={[
            styles.convName,
            item.unreadCount > 0 && styles.convNameBold,
          ]} numberOfLines={1}>
            {item.otherUserName}
          </Text>
          <Text style={[
            styles.convTime,
            item.unreadCount > 0 && { color: accentColor },
          ]}>
            {formatTime(item.lastMessageTime)}
          </Text>
        </View>

        <View style={styles.convBottomRow}>
          <Text style={[
            styles.convPreview,
            item.unreadCount > 0 && styles.convPreviewBold,
          ]} numberOfLines={1}>
            {item.isLastMessageMine ? 'You: ' : ''}{item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.unreadText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>

        {item.otherUserRole && (
          <Text style={styles.convRole}>
            {item.otherUserRole === 'worker' ? '🔨 Worker' : '👤 Client'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        {/* Header stays visible during loading */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.headerRight}>
            <View style={styles.headerBtn}>
              <Text style={styles.headerBtnIcon}>🔍</Text>
            </View>
          </View>
        </View>
        {/* Skeleton conversations */}
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={styles.skeletonConvRow}>
              <View style={styles.skeletonAvatar} />
              <View style={styles.skeletonConvInfo}>
                <View style={styles.skeletonConvTop}>
                  <View style={[styles.skeletonLine, { width: 120 }]} />
                  <View style={[styles.skeletonLine, { width: 30 }]} />
                </View>
                <View style={[styles.skeletonLine, { width: 200, height: 10, marginTop: 8 }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const query = searchQuery.trim().toLowerCase();
  const visibleConversations = query
    ? conversations.filter(c =>
        c.otherUserName.toLowerCase().includes(query) ||
        (c.lastMessage || '').toLowerCase().includes(query))
    : conversations;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              // Closing clears the query, so reopening never shows a
              // filtered list with an empty-looking box above it.
              setSearchOpen(open => { if (open) setSearchQuery(''); return !open; });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.headerBtnIcon}>{searchOpen ? '✕' : '🔍'}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {searchOpen && (
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={role === 'client' ? 'Search workers…' : 'Search clients…'}
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {callLogs.length > 0 && (
        <Animated.View style={[styles.callLogSection, { opacity: headerOpacity }]}>
          <Text style={styles.callLogTitle}>Recent Calls</Text>
          <FlatList
            data={callLogs}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.callLogList}
            renderItem={({ item }) => {
              const missedOrDeclined = item.status === 'missed' || item.status === 'declined' || item.status === 'cancelled';
              const statusIcon = item.wasOutgoing ? '↗️' : missedOrDeclined ? '↙️' : '↩️';
              const statusLabel = item.status === 'completed'
                ? formatCallDuration(item.durationSeconds)
                : item.status === 'missed' ? 'No answer'
                : item.status === 'declined' ? 'Declined'
                : 'Cancelled';

              return (
                <TouchableOpacity
                  style={styles.callLogCard}
                  onPress={() => navigation.navigate('OutgoingCall', { workerName: item.otherUserName, workerCategory: '', workerId: item.otherUserId })}
                  activeOpacity={0.85}
                >
                  <View style={[styles.callLogAvatar, missedOrDeclined && !item.wasOutgoing && styles.callLogAvatarMissed]}>
                    <Text style={styles.callLogAvatarText}>{getInitials(item.otherUserName)}</Text>
                  </View>
                  <Text style={styles.callLogName} numberOfLines={1}>{item.otherUserName}</Text>
                  <View style={styles.callLogStatusRow}>
                    <Text style={styles.callLogStatusIcon}>{statusIcon}</Text>
                    <Text style={[styles.callLogStatusText, missedOrDeclined && !item.wasOutgoing && { color: '#EF4444' }]}>
                      {statusLabel}
                    </Text>
                  </View>
                  <Text style={styles.callLogTime}>{item.time}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </Animated.View>
      )}

      {/* Conversations list */}
      <Animated.View style={[styles.listContainer, { opacity: listOpacity }]}>
        {visibleConversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>{query ? '🔍' : '💬'}</Text>
            </View>
            <Text style={styles.emptyTitle}>{query ? 'No match' : 'No messages yet'}</Text>
            <Text style={styles.emptyDesc}>
              {query
                ? `Nobody in your messages matches “${searchQuery.trim()}”.`
                : role === 'client'
                  ? 'When you book a worker or send a message, it will appear here'
                  : 'When clients contact you, their messages will appear here'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={visibleConversations}
            renderItem={renderConversation}
            keyExtractor={item => item.otherUserId}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.screenPadding, marginBottom: 10,
    paddingHorizontal: 14, height: 42, borderRadius: 12,
    backgroundColor: colors.white + '05', borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { fontSize: 13, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, padding: 0 },
  searchClear: { fontSize: 13, color: colors.textMuted, padding: 4 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white + '08',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnIcon: {
    fontSize: 16,
  },

  // Recent Calls
  callLogSection: {
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  callLogTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 10,
  },
  callLogList: {
    paddingHorizontal: spacing.screenPadding,
    gap: 12,
    paddingBottom: 12,
  },
  callLogCard: {
    width: 76,
    alignItems: 'center',
  },
  callLogAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  callLogAvatarMissed: {
    backgroundColor: '#EF444420',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  callLogAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  callLogName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  callLogStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  callLogStatusIcon: {
    fontSize: 9,
  },
  callLogStatusText: {
    fontSize: 9,
    color: colors.textMuted,
  },
  callLogTime: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },

  // Loading
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 12,
  },

  // List
  listContainer: {
    flex: 1,
  },

  // Conversation row
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  convInfo: {
    flex: 1,
  },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  convNameBold: {
    fontWeight: '700',
  },
  convTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  convBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convPreview: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
    marginRight: 8,
  },
  convPreviewBold: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  convRole: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 3,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Skeleton loading
  skeletonList: {
    paddingTop: 8,
  },
  skeletonConvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bgCard,
    marginRight: 14,
  },
  skeletonConvInfo: {
    flex: 1,
  },
  skeletonConvTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.bgCard,
  },
});
