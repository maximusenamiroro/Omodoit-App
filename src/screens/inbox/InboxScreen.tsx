import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, StatusBar, Animated, Platform,
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

export default function InboxScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(listOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchConversations();
      fetchCallLogs();
      setupRealtime();
    }
  }, [user?.id]);

  const fetchCallLogs = async () => {
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
  };

  const channelRef = useRef<any>(null);

  const setupRealtime = () => {
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
  };

  const fetchConversations = async () => {
    if (!user?.id) return;

    try {
      const { data: allMessages, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, text, seen, created_at, message_type')
        .or('sender_id.eq.' + user.id + ',receiver_id.eq.' + user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!allMessages || allMessages.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const convMap = new Map<string, {
        lastMsg: any;
        unread: number;
      }>();

      allMessages.forEach((msg: any) => {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(otherId)) {
          convMap.set(otherId, {
            lastMsg: msg,
            unread: (!msg.seen && msg.receiver_id === user.id) ? 1 : 0,
          });
        } else {
          const existing = convMap.get(otherId)!;
          if (!msg.seen && msg.receiver_id === user.id) {
            existing.unread += 1;
          }
        }
      });

      const otherUserIds = Array.from(convMap.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('id', otherUserIds);

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

      const convList: Conversation[] = otherUserIds.map(otherId => {
        const conv = convMap.get(otherId)!;
        const profile = profileMap.get(otherId);
        const lastMsg = conv.lastMsg;

        let preview = lastMsg.text || '';
        if (lastMsg.message_type === 'image') preview = '📷 Photo';
        if (lastMsg.message_type === 'video') preview = '🎥 Video';
        if (lastMsg.message_type === 'audio') preview = '🎤 Voice message';
        if (lastMsg.message_type === 'file') preview = '📎 File';

        return {
          otherUserId: otherId,
          otherUserName: profile?.full_name || 'User',
          otherUserAvatar: profile?.avatar_url || null,
          otherUserRole: profile?.role || null,
          lastMessage: preview,
          lastMessageTime: lastMsg.created_at,
          lastMessageType: lastMsg.message_type || 'text',
          unreadCount: conv.unread,
          isLastMessageMine: lastMsg.sender_id === user.id,
        };
      });

      convList.sort((a, b) =>
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      setConversations(convList);
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Text style={styles.headerBtnIcon}>🔍</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

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
        {conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>💬</Text>
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyDesc}>
              {role === 'client'
                ? 'When you book a worker or send a message, it will appear here'
                : 'When clients contact you, their messages will appear here'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
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
