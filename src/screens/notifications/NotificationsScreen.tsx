import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Animated, StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';

const timeAgo = (date: string): string => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface Notification {
  id: string;
  type: string;
  message: string;
  fromName: string;
  isRead: boolean;
  createdAt: string;
}

const NOTIF_ICONS: Record<string, { emoji: string; color: string }> = {
  booking: { emoji: '📋', color: '#3B82F6' },
  message: { emoji: '💬', color: '#06B6D4' },
  like: { emoji: '❤️', color: '#EF4444' },
  comment: { emoji: '💬', color: '#8B5CF6' },
  follow: { emoji: '👤', color: '#16a34a' },
  system: { emoji: '🔔', color: '#F59E0B' },
  flash: { emoji: '⚡', color: '#F97316' },
};

const NOTIF_LABELS: Record<string, string> = {
  booking: 'Booking',
  message: 'Message',
  like: 'Like',
  comment: 'Comment',
  follow: 'New Follower',
  system: 'Omodoit',
  flash: 'Flash Job',
};

export default function NotificationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const accentColor = role === 'client' ? colors.client : colors.primary;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(listOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  // Reads from the notifications table written to by HireWorkerScreen
  // (new booking) and WorkstationScreen (accept/decline). Schema
  // confirmed from the website's own NotificationsPage.jsx, which
  // reads this same table: id, type, message, is_read, created_at,
  // reel_id, booking_id, order_id, from_user_id, user_id.
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('notifications')
        .select('id, type, message, from_user_id, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const fromIds = [...new Set((rows || []).map((r: any) => r.from_user_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (fromIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', fromIds);
        (profileRows || []).forEach((p: any) => { nameMap[p.id] = p.full_name || 'Someone'; });
      }

      const mapped: Notification[] = (rows || []).map((r: any) => ({
        id: r.id,
        type: r.type || 'system',
        message: r.message || '',
        fromName: nameMap[r.from_user_id] || 'Omodoit',
        isRead: !!r.is_read,
        createdAt: r.created_at,
      }));

      setNotifications(mapped);
    } catch (err) {
      console.warn('Could not load notifications (non-fatal):', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadNotifications(); }, [loadNotifications]));

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('notifications_' + user.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
      }, () => loadNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    if (!user?.id) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    } catch (err) {
      console.warn('Could not mark notifications read (non-fatal):', err);
    }
  };

  const markOneRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (err) {
      console.warn('Could not mark notification read (non-fatal):', err);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = NOTIF_ICONS[item.type] || NOTIF_ICONS.system;
    return (
      <TouchableOpacity
        style={[styles.notifRow, !item.isRead && styles.notifRowUnread]}
        activeOpacity={0.7}
        onPress={() => markOneRead(item.id)}
      >
        <View style={[styles.notifIconBg, { backgroundColor: icon.color + '15' }]}>
          <Text style={styles.notifEmoji}>{icon.emoji}</Text>
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifTopRow}>
            <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleBold]} numberOfLines={1}>
              {NOTIF_LABELS[item.type] || 'Notification'}
            </Text>
            <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>
            <Text style={styles.notifFromName}>{item.fromName}</Text>
            {' '}{item.message}
          </Text>
        </View>
        {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
            <Text style={[styles.markAllText, { color: accentColor }]}>Read all</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </Animated.View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={accentColor} />
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: listOpacity }}>
          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyDesc}>When someone books you, likes your reel, or sends a message, you will see it here</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              renderItem={renderNotification}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  headerBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  headerBadgeText: { fontSize: 10, fontWeight: '700', color: colors.white },
  markAllText: { fontSize: 12, fontWeight: '600' },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  notifRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.screenPadding, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  notifRowUnread: { backgroundColor: colors.white + '03' },
  notifIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  notifEmoji: { fontSize: 20 },
  notifContent: { flex: 1 },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  notifTitle: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, flex: 1, marginRight: 8 },
  notifTitleBold: { fontWeight: '700' },
  notifTime: { fontSize: 10, color: colors.textMuted },
  notifBody: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  notifFromName: { fontWeight: '600', color: colors.textSecondary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16, opacity: 0.4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
