import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TextInput, Image, StatusBar, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';

const getInitials = (name: string | null): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

const formatMsgTime = (date: string): string => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDateHeader = (date: string): string => {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  seen: boolean;
  created_at: string;
  message_type: string | null;
  media_url: string | null;
}

// One screenful and change. Older messages load as the user scrolls up.
const MESSAGE_PAGE_SIZE = 50;

export default function ChatScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const { otherUserId, otherUserName, otherUserAvatar } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);

  const accentColor = role === 'client' ? colors.client : colors.primary;

  const markAsSeen = useCallback(async () => {
    if (!user?.id) return;
    try {
      await supabase
        .from('messages')
        .update({ seen: true })
        .eq('sender_id', otherUserId)
        .eq('receiver_id', user.id)
        .eq('seen', false);
    } catch (err) {
      console.error('Mark seen error:', err);
    }
  }, [user?.id, otherUserId]);

  const setupRealtime = useCallback(() => {
    if (!user?.id) return;
    channelRef.current = supabase
      .channel('chat_' + otherUserId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload: any) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_id === user.id && msg.receiver_id === otherUserId) ||
          (msg.sender_id === otherUserId && msg.receiver_id === user.id)
        ) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.sender_id === otherUserId) {
            markAsSeen();
          }
        }
      })
      .subscribe();
  }, [user?.id, otherUserId, markAsSeen]);

  // Both directions of one conversation. Written out twice because
  // PostgREST has no "either of these two pairs" operator.
  const conversationFilter = useCallback(() => (
    'and(sender_id.eq.' + user?.id + ',receiver_id.eq.' + otherUserId + '),' +
    'and(sender_id.eq.' + otherUserId + ',receiver_id.eq.' + user?.id + ')'
  ), [user?.id, otherUserId]);

  const fetchMessages = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Newest page first, then flipped for display. Fetching the whole
      // conversation ascending meant a long-running chat re-downloaded
      // thousands of messages every time it was opened.
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(conversationFilter())
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      if (error) throw error;
      const page = ((data as Message[]) || []).slice().reverse();
      setMessages(page);
      setHasOlder(page.length === MESSAGE_PAGE_SIZE);
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, conversationFilter]);

  // Pulls the previous page when the user scrolls back to the top.
  const loadOlderMessages = useCallback(async () => {
    if (!user?.id || loadingOlder || !hasOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(conversationFilter())
        .lt('created_at', messages[0].created_at)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      if (error) throw error;
      const older = ((data as Message[]) || []).slice().reverse();
      setHasOlder(older.length === MESSAGE_PAGE_SIZE);
      if (older.length > 0) {
        setMessages(prev => {
          const seen = new Set(prev.map(m => m.id));
          return [...older.filter(m => !seen.has(m.id)), ...prev];
        });
      }
    } catch (err) {
      console.error('Fetch older messages error:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [user?.id, conversationFilter, messages, loadingOlder, hasOlder]);

  useEffect(() => {
    fetchMessages();
    markAsSeen();
    setupRealtime();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // These are memoised on user id and the person being messaged, so
    // this still runs once per conversation — but opening a different
    // chat now genuinely re-subscribes instead of reusing a channel
    // bound to the previous one.
  }, [fetchMessages, markAsSeen, setupRealtime]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user?.id || sending) return;
    const msgText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const optimisticMsg: Message = {
      id: 'temp_' + Date.now(),
      sender_id: user.id,
      receiver_id: otherUserId,
      text: msgText,
      seen: false,
      created_at: new Date().toISOString(),
      message_type: 'text',
      media_url: null,
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: otherUserId,
          text: msgText,
          message_type: 'text',
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev =>
        prev.map(m => m.id === optimisticMsg.id ? (data as Message) : m)
      );
    } catch (err) {
      console.error('Send message error:', err);
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isMine = item.sender_id === user?.id;
    const showDateHeader = index === 0 ||
      formatDateHeader(item.created_at) !== formatDateHeader(messages[index - 1].created_at);

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeaderRow}>
            <View style={styles.dateHeaderBg}>
              <Text style={styles.dateHeaderText}>
                {formatDateHeader(item.created_at)}
              </Text>
            </View>
          </View>
        )}
        <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowTheirs]}>
          <View style={[
            styles.msgBubble,
            isMine
              ? [styles.msgBubbleMine, { backgroundColor: accentColor }]
              : styles.msgBubbleTheirs,
          ]}>
            <Text style={[
              styles.msgText,
              isMine ? styles.msgTextMine : styles.msgTextTheirs,
            ]}>
              {item.text}
            </Text>
            <View style={styles.msgMeta}>
              <Text style={[
                styles.msgTime,
                isMine ? styles.msgTimeMine : styles.msgTimeTheirs,
              ]}>
                {formatMsgTime(item.created_at)}
              </Text>
              {isMine && (
                <Text style={styles.msgSeen}>
                  {item.seen ? '✓✓' : '✓'}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }, [user?.id, messages, accentColor]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.chatHeader}>
          <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>←</Text>
          </PressableScale>
          <Text style={styles.chatHeaderName}>{otherUserName}</Text>
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Chat header */}
      <View style={styles.chatHeader}>
        <PressableScale style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </PressableScale>

        {otherUserAvatar ? (
          <Image source={{ uri: otherUserAvatar }} style={styles.chatAvatar} />
        ) : (
          <View style={[styles.chatAvatarFallback, { backgroundColor: accentColor }]}>
            <Text style={styles.chatAvatarText}>{getInitials(otherUserName)}</Text>
          </View>
        )}

        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName} numberOfLines={1}>{otherUserName}</Text>
          <Text style={styles.chatHeaderStatus}>Tap for profile</Text>
        </View>

        <PressableScale
          style={styles.headerAction}
          onPress={() => navigation.navigate('OutgoingCall', {
            workerName: otherUserName, workerCategory: '', workerId: otherUserId,
          })}
        >
          <Text style={styles.headerActionIcon}>📞</Text>
        </PressableScale>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChatContainer}>
            {otherUserAvatar ? (
              <Image source={{ uri: otherUserAvatar }} style={styles.emptyChatAvatar} />
            ) : (
              <View style={[styles.emptyChatAvatarFb, { backgroundColor: accentColor }]}>
                <Text style={styles.emptyChatAvatarText}>{getInitials(otherUserName)}</Text>
              </View>
            )}
            <Text style={styles.emptyChatName}>{otherUserName}</Text>
            <Text style={styles.emptyChatDesc}>
              Send a message to start the conversation
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.msgList}
            onContentSizeChange={() => {
              // Prepending older messages also changes content size;
              // scrolling to the end there would yank the user back down.
              if (!loadingOlder) flatListRef.current?.scrollToEnd({ animated: true });
            }}
            onStartReached={loadOlderMessages}
            onStartReachedThreshold={0.2}
            ListHeaderComponent={
              loadingOlder ? <ActivityIndicator color={colors.primary} style={styles.olderLoader} /> : null
            }
            onLayout={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
          />
        )}

        {/* Input */}
        <View style={[styles.inputBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 4 : 12 }]}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
            />
            <PressableScale
              style={[
                styles.sendBtn,
                { backgroundColor: newMessage.trim() ? accentColor : colors.bgCard },
              ]}
              onPress={handleSend}
              disabled={!newMessage.trim() || sending}
            >
              <Text style={styles.sendText}>{sending ? '...' : '↑'}</Text>
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Chat header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white + '08',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  backText: {
    fontSize: 18,
    color: colors.white,
    fontWeight: '700',
  },
  chatAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
  },
  chatAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chatAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chatHeaderStatus: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white + '08',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerActionIcon: {
    fontSize: 18,
  },

  // Loading
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chat body
  chatBody: {
    flex: 1,
  },
  olderLoader: { marginVertical: 12 },
  msgList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },

  // Date header
  dateHeaderRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateHeaderBg: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dateHeaderText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },

  // Message row
  msgRow: {
    marginBottom: 6,
    maxWidth: '80%',
  },
  msgRowMine: {
    alignSelf: 'flex-end',
  },
  msgRowTheirs: {
    alignSelf: 'flex-start',
  },

  // Message bubble
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  msgBubbleMine: {
    borderBottomRightRadius: 4,
  },
  msgBubbleTheirs: {
    backgroundColor: colors.bgCard,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTextMine: {
    color: colors.white,
  },
  msgTextTheirs: {
    color: colors.textPrimary,
  },

  // Message meta
  msgMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  msgTime: {
    fontSize: 10,
  },
  msgTimeMine: {
    color: 'rgba(255,255,255,0.6)',
  },
  msgTimeTheirs: {
    color: colors.textMuted,
  },
  msgSeen: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },

  // Input bar
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    color: colors.textPrimary,
    maxHeight: 100,
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },

  // Empty chat
  emptyChatContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyChatAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 14,
  },
  emptyChatAvatarFb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyChatAvatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
  },
  emptyChatName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyChatDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
