import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  Dimensions, StatusBar, Animated, Image, ActivityIndicator,
  TextInput, Modal, Share, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import { colors } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import { useIsFocused } from '@react-navigation/native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Caps on lists that grow without bound as the platform does. Each is a
// screenful or two of content — none of these views can show more.
const COMMENT_FETCH_LIMIT = 100;
const FOLLOWING_FETCH_LIMIT = 300;
const WORKER_PRODUCT_LIMIT = 30;

const formatCount = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'm';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
};

const getInitials = (name: string | null): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return parts[0][0];
};

const timeAgo = (date: string): string => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface ReelProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  category: string | null;
  subcategory: string | null;
  location: string | null;
  verification_level: number;
}


interface Reel {
  id: string;
  video_url: string;
  // Poster frame shown while the video buffers. Null for every reel
  // uploaded before thumbnails existed, so it must stay optional.
  thumbnail_url: string | null;
  description: string | null;
  type: string | null;
  likes: number;
  created_at: string;
  profiles: ReelProfile;
}



function CommentSheet({ visible, onClose, reelId, userId }: {
  visible: boolean; onClose: () => void; reelId: string; userId: string | undefined;
}) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reel_comments')
        .select('id, user_id, comment, created_at, parent_id, profiles(full_name, avatar_url)')
        .eq('reel_id', reelId)
        .order('created_at', { ascending: true })
        .limit(COMMENT_FETCH_LIMIT);
      if (error) throw error;
      const formatted = (data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
      }));
      const topLevel = formatted.filter((c: any) => !c.parent_id);
      const replies = formatted.filter((c: any) => c.parent_id);
      const withReplies = topLevel.map((c: any) => ({
        ...c,
        replies: replies.filter((r: any) => r.parent_id === c.id),
      }));
      setComments(withReplies);
    } catch (err) { console.error('Fetch comments error:', err); }
    finally { setLoading(false); }
  }, [reelId]);

  useEffect(() => { if (visible) fetchComments(); }, [visible, fetchComments]);

  const handlePost = async () => {
    if (!newComment.trim() || !userId) return;
    setPosting(true);
    try {
      const insertData: any = { user_id: userId, reel_id: reelId, comment: newComment.trim() };
      if (replyTo) insertData.parent_id = replyTo.id;
      const { error } = await supabase.from('reel_comments').insert(insertData);
      if (error) throw error;
      setNewComment('');
      setReplyTo(null);
      fetchComments();
    } catch (err) { console.error('Post comment error:', err); }
    finally { setPosting(false); }
  };

  const handleReply = (commentId: string, name: string) => {
    setReplyTo({ id: commentId, name });
    inputRef.current?.focus();
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const totalComments = comments.reduce((sum: number, c: any) => sum + 1 + (c.replies?.length || 0), 0);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <PressableScale style={cs.overlay} onPress={onClose}>
        <View style={cs.dismissArea} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={cs.sheet}>
          <PressableScale onPress={(e: any) => e.stopPropagation()} style={cs.sheetInner}>
            <View style={cs.handle}><View style={cs.handleBar} /></View>
            <View style={cs.header}>
              <Text style={cs.headerTitle}>Comments ({totalComments})</Text>
              <PressableScale onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={cs.closeBtn}>\u2715</Text>
              </PressableScale>
            </View>

            {loading ? (
              <View style={cs.center}><ActivityIndicator color={colors.primary} /></View>
            ) : comments.length === 0 ? (
              <View style={cs.center}>
                <Text style={cs.emptyEmoji}>\ud83d\udcac</Text>
                <Text style={cs.emptyText}>No comments yet</Text>
                <Text style={cs.emptyDesc}>Be the first to comment!</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item: any) => item.id}
                style={cs.list}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }: any) => (
                  <View>
                    <View style={cs.row}>
                      {item.profiles?.avatar_url ? (
                        <Image source={{ uri: item.profiles.avatar_url }} style={cs.avatar} />
                      ) : (
                        <View style={cs.avatarFb}><Text style={cs.avatarFbText}>{getInitials(item.profiles?.full_name)}</Text></View>
                      )}
                      <View style={cs.content}>
                        <View style={cs.nameRow}>
                          <Text style={cs.name}>{item.profiles?.full_name || 'User'}</Text>
                          <Text style={cs.time}>{timeAgo(item.created_at)}</Text>
                        </View>
                        <Text style={cs.commentText}>{item.comment}</Text>
                        <View style={cs.actionRow}>
                          <PressableScale onPress={() => handleReply(item.id, item.profiles?.full_name || 'User')}>
                            <Text style={cs.replyBtn}>Reply</Text>
                          </PressableScale>
                          {item.replies && item.replies.length > 0 && (
                            <PressableScale onPress={() => toggleReplies(item.id)}>
                              <Text style={cs.viewRepliesBtn}>
                                {expandedReplies.has(item.id) ? 'Hide replies' : 'View ' + item.replies.length + (item.replies.length === 1 ? ' reply' : ' replies')}
                              </Text>
                            </PressableScale>
                          )}
                        </View>
                      </View>
                    </View>
                    {expandedReplies.has(item.id) && item.replies && item.replies.map((reply: any) => (
                      <View key={reply.id} style={cs.replyRow}>
                        {reply.profiles?.avatar_url ? (
                          <Image source={{ uri: reply.profiles.avatar_url }} style={cs.replyAvatar} />
                        ) : (
                          <View style={cs.replyAvatarFb}><Text style={cs.replyAvatarFbText}>{getInitials(reply.profiles?.full_name)}</Text></View>
                        )}
                        <View style={cs.content}>
                          <View style={cs.nameRow}>
                            <Text style={cs.name}>{reply.profiles?.full_name || 'User'}</Text>
                            <Text style={cs.time}>{timeAgo(reply.created_at)}</Text>
                          </View>
                          <Text style={cs.commentText}>{reply.comment}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              />
            )}

            {replyTo && (
              <View style={cs.replyIndicator}>
                <Text style={cs.replyIndicatorText}>Replying to {replyTo.name}</Text>
                <PressableScale onPress={() => setReplyTo(null)}>
                  <Text style={cs.replyCancel}>\u2715</Text>
                </PressableScale>
              </View>
            )}

            <View style={[cs.inputRow, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 4 : 12 }]}>
              <TextInput
                ref={inputRef}
                style={cs.input}
                value={newComment}
                onChangeText={setNewComment}
                placeholder={replyTo ? 'Reply to ' + replyTo.name + '...' : 'Add a comment...'}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
              />
              <PressableScale
                style={[cs.sendBtn, !newComment.trim() && cs.sendBtnOff]}
                onPress={handlePost}
                disabled={!newComment.trim() || posting}
              >
                <Text style={cs.sendText}>{posting ? '...' : '\u2191'}</Text>
              </PressableScale>
            </View>
          </PressableScale>
        </KeyboardAvoidingView>
      </PressableScale>
    </Modal>
  );
}

const cs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: { maxHeight: Platform.OS === 'ios' ? SCREEN_H * 0.75 : SCREEN_H * 0.8, minHeight: SCREEN_H * 0.5 },
  sheetInner: { flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  handle: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.white + '20' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  closeBtn: { fontSize: 18, color: colors.textMuted, padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 36, marginBottom: 8, opacity: 0.5 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  emptyDesc: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  list: { flex: 1, paddingHorizontal: 20 },
  row: { flexDirection: 'row', paddingVertical: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, marginRight: 12 },
  avatarFb: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarFbText: { fontSize: 13, fontWeight: '700', color: colors.white },
  content: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  name: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  time: { fontSize: 10, color: colors.textMuted },
  commentText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  replyBtn: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  viewRepliesBtn: { fontSize: 11, fontWeight: '600', color: colors.primary },
  replyRow: { flexDirection: 'row', paddingVertical: 8, paddingLeft: 46 },
  replyAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 10 },
  replyAvatarFb: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  replyAvatarFbText: { fontSize: 10, fontWeight: '700', color: colors.white },
  replyIndicator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.border },
  replyIndicatorText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  replyCancel: { fontSize: 16, color: colors.textMuted, paddingLeft: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, backgroundColor: colors.bgInput, borderRadius: 20, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 14, color: colors.textPrimary, maxHeight: 80, marginRight: 10, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Platform.OS === 'ios' ? 0 : 2 },
  sendBtnOff: { backgroundColor: colors.bgCard },
  sendText: { fontSize: 16, fontWeight: '700', color: colors.white },
});

// "Order Now" opens this — shows the reel poster's real products,
// matching the website's ReelCard exactly. Tapping a product goes to
// the same ProductDetailScreen used everywhere else in the app.
function ProductSheet({ visible, onClose, workerId, workerName, navigation }: {
  visible: boolean; onClose: () => void; workerId: string; workerName: string; navigation: any;
}) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, title, price, image_url, description, category, worker_id')
          .eq('worker_id', workerId)
          .order('created_at', { ascending: false })
          .limit(WORKER_PRODUCT_LIMIT);
        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error('fetchWorkerProducts error:', err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [visible, workerId]);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <PressableScale style={cs.overlay} onPress={onClose}>
        <View style={cs.dismissArea} />
        <View style={[cs.sheet, { maxHeight: SCREEN_H * 0.6 }]}>
          <PressableScale onPress={(e: any) => e.stopPropagation()} style={cs.sheetInner}>
            <View style={cs.handle}><View style={cs.handleBar} /></View>
            <View style={cs.header}>
              <Text style={cs.headerTitle}>@{workerName} — Products</Text>
              <PressableScale onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={cs.closeBtn}>✕</Text>
              </PressableScale>
            </View>

            {loading ? (
              <View style={cs.center}><ActivityIndicator color={colors.primary} /></View>
            ) : products.length === 0 ? (
              <View style={cs.center}>
                <Text style={cs.emptyEmoji}>📦</Text>
                <Text style={cs.emptyText}>No products listed yet</Text>
                <PressableScale onPress={() => {
                  onClose();
                  navigation.navigate('WorkerPublicProfile', {
                    worker: { id: workerId, name: workerName, rating: 0, reviews: 0, location: '', experience: '', verified: false, bio: '' },
                    subcategoryName: '',
                  });
                }}>
                  <Text style={[cs.emptyDesc, { color: colors.primary, marginTop: 10 }]}>View Profile →</Text>
                </PressableScale>
              </View>
            ) : (
              <ScrollView style={ps.list} showsVerticalScrollIndicator={false}>
                {products.map(product => (
                  <PressableScale
                    key={product.id}
                    style={ps.productRow}
                    onPress={() => {
                      onClose();
                      navigation.navigate('ProductDetail', {
                        product: {
                          id: product.id,
                          title: product.title,
                          price: product.price,
                          category: product.category,
                          imageUrl: product.image_url,
                          sellerName: workerName,
                          workerId: product.worker_id,
                          description: product.description,
                        },
                      });
                    }}
                  >
                    <View style={ps.productThumb}>
                      {product.image_url ? (
                        <Image source={{ uri: product.image_url }} style={ps.productImg} />
                      ) : (
                        <Text style={ps.productEmoji}>📦</Text>
                      )}
                    </View>
                    <View style={ps.productInfo}>
                      <Text style={ps.productTitle} numberOfLines={1}>{product.title}</Text>
                      <Text style={ps.productPrice}>
                        {product.price != null ? `₦${Number(product.price).toLocaleString()}` : 'Contact for price'}
                      </Text>
                    </View>
                    <Text style={ps.productArrow}>→</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            )}
          </PressableScale>
        </View>
      </PressableScale>
    </Modal>
  );
}

const ps = StyleSheet.create({
  list: { flex: 1, paddingHorizontal: 20 },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  productThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  productImg: { width: '100%', height: '100%' },
  productEmoji: { fontSize: 18 },
  productInfo: { flex: 1 },
  productTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 3 },
  productPrice: { fontSize: 13, fontWeight: '700', color: colors.primary },
  productArrow: { fontSize: 14, color: colors.textMuted },
});

interface ReelCardProps { reel: Reel; isClient: boolean; isActive: boolean; userId: string | undefined; navigation: any; }

function ReelCard({ reel, isClient, isActive, userId, navigation }: ReelCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(reel.likes);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showProductSheet, setShowProductSheet] = useState(false);
  const isOwnReel = userId === reel.profiles?.id;
  const [paused, setPaused] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  const likeScale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const actionsSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (!userId) return;
    supabase.from('reel_likes').select('id').eq('user_id', userId).eq('reel_id', reel.id).maybeSingle()
      .then(({ data }) => { if (data) setLiked(true); });
    supabase.from('saved_reels').select('id').eq('user_id', userId).eq('reel_id', reel.id).maybeSingle()
      .then(({ data }) => { if (data) setSaved(true); });
    if (reel.profiles?.id) {
      supabase.from('follows').select('id').eq('follower_id', userId).eq('following_id', reel.profiles.id).maybeSingle()
        .then(({ data }) => { if (data) setFollowing(true); });
    }
    supabase.from('reel_comments').select('id', { count: 'exact', head: true }).eq('reel_id', reel.id)
      .then(({ count }) => { if (count !== null) setCommentCount(count); });
      // Count likes from reel_likes table — same as website
    supabase.from('reel_likes').select('id', { count: 'exact', head: true }).eq('reel_id', reel.id)
      .then(({ count }) => { if (count !== null) setLikeCount(count); });
  }, [userId, reel.id, reel.profiles.id]);

  useEffect(() => {
    if (isActive) {
      setPaused(false);
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
        Animated.spring(actionsSlide, { toValue: 0, damping: 14, stiffness: 80, delay: 300, useNativeDriver: true }),
      ]).start();
    } else { setPaused(true); }
  }, [isActive, actionsSlide, contentOpacity]);

  const handleLike = async () => {
    if (!userId) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1, damping: 8, stiffness: 200, useNativeDriver: true }),
    ]).start();
    try {
      if (wasLiked) {
        await supabase.from('reel_likes').delete().eq('user_id', userId).eq('reel_id', reel.id);
      } else {
        const { error } = await supabase.from('reel_likes').insert({ user_id: userId, reel_id: reel.id });
        // 23505 = already liked (unique constraint) — treat as success
        if (error && error.code !== '23505') throw error;
      }
    } catch {
      // Revert on error
      setLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    const wasSaved = saved; setSaved(!wasSaved);
    try {
      if (wasSaved) { await supabase.from('saved_reels').delete().eq('user_id', userId).eq('reel_id', reel.id); }
      else { await supabase.from('saved_reels').insert({ user_id: userId, reel_id: reel.id }); }
    } catch { setSaved(wasSaved); }
  };

  const handleFollow = async () => {
    if (!userId || !reel.profiles?.id) return;
    const wasFollowing = following; setFollowing(!wasFollowing);
    try {
      if (wasFollowing) { await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', reel.profiles.id); }
      else { await supabase.from('follows').insert({ follower_id: userId, following_id: reel.profiles.id }); }
    } catch { setFollowing(wasFollowing); }
  };

 const handleShare = async () => {
    const shareUrl = 'https://omoworkit.com/reel/' + reel.id;
    const workerName = reel.profiles?.full_name || 'Check out this worker';
    const caption = reel.description ? reel.description + '\n\n' : '';
    try {
      await Share.share({
        message: workerName + ' on Omodoit\n\n' + caption + shareUrl,
      });
    } catch {}
  };

  // "Order Now" for product reels vs "Book Now" for service reels,
  // matching the website's ReelCard exactly. Only shown to clients,
  // never on your own reel.
  const handleBookNow = () => {
    if (!reel.profiles?.id) return;
    navigation.navigate('HireWorker', {
      worker: {
        id: reel.profiles.id,
        name: reel.profiles.full_name || 'Worker',
      },
      subcategoryName: reel.profiles.subcategory || reel.profiles.category || reel.type,
    });
  };

  const handleOrderNow = () => {
    setShowProductSheet(true);
  };

  const handleMessage = () => {
    if (!reel.profiles?.id) return;
    navigation.navigate('Chat', {
      otherUserId: reel.profiles.id,
      otherUserName: reel.profiles.full_name || 'Worker',
      otherUserAvatar: reel.profiles.avatar_url || null,
    });
  };

  const workerName = reel.profiles?.full_name || 'Worker';
  const category = reel.profiles?.subcategory || reel.profiles?.category || reel.type || 'Service';
  const location = reel.profiles?.location || 'Nigeria';
  const isVerified = (reel.profiles?.verification_level ?? 0) >= 1;

  return (
    <View style={[styles.reelContainer, { height: SCREEN_H }]}>
      <PressableScale onPress={() => setPaused(!paused)} style={styles.videoContainer}>
        {!videoError ? (
         <Video
            source={{ uri: reel.video_url, type: 'mp4' }}
            style={styles.video}
            resizeMode="cover"
            repeat
            paused={paused || !isActive}
            muted={false}
            onLoad={() => setVideoLoaded(true)}
            onError={(e) => { console.log('Video error:', JSON.stringify(e)); setVideoError(true); }}
            onBuffer={({ isBuffering }: { isBuffering: boolean }) => {
              if (!isBuffering && !videoLoaded) setVideoLoaded(true);
            }}
            useTextureView={Platform.OS === 'android'}
            bufferConfig={{
              minBufferMs: 5000,
              maxBufferMs: 30000,
              bufferForPlaybackMs: 2500,
              bufferForPlaybackAfterRebufferMs: 5000,
            }}
          />
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>📹</Text>
            <Text style={styles.errorText}>Video unavailable</Text>
            <PressableScale
              style={styles.retryVideoBtn}
              onPress={() => { setVideoError(false); setVideoLoaded(false); }}
            >
              <Text style={styles.retryVideoText}>Tap to retry</Text>
            </PressableScale>
          </View>
        )}
        {/* Poster frame, sitting under the spinner until the first
            video frame is ready. Without it this area is pure black
            for as long as buffering takes, which is what makes the
            feed feel slow even when it isn't. */}
        {!videoLoaded && !videoError && !!reel.thumbnail_url && (
          <Image
            source={{ uri: reel.thumbnail_url }}
            style={styles.video}
            resizeMode="cover"
          />
        )}
        {!videoLoaded && !videoError && (<View style={styles.loadingOverlay}><ActivityIndicator size="large" color={colors.white} /></View>)}
        {paused && (<View style={styles.pauseOverlay}><View style={styles.pauseIcon}><Text style={styles.pauseText}>▶</Text></View></View>)}
      </PressableScale>

      <Animated.View style={[styles.actionsColumn, { bottom: Platform.OS === 'ios' ? (isClient ? 190 : 170) : (isClient ? 150 : 130), opacity: contentOpacity, transform: [{ translateX: actionsSlide }] }]}>
        <PressableScale style={styles.actionAvatarContainer} onPress={isClient ? handleFollow : undefined}>
          {reel.profiles?.avatar_url ? (
            <Image source={{ uri: reel.profiles.avatar_url }} style={styles.actionAvatar} />
          ) : (
            <View style={[styles.actionAvatarFallback, { backgroundColor: colors.primary }]}><Text style={styles.actionAvatarText}>{getInitials(workerName)}</Text></View>
          )}
          {isClient && (<View style={[styles.actionAvatarPlus, following && { backgroundColor: '#22c55e' }]}><Text style={styles.plusText}>{following ? '✓' : '+'}</Text></View>)}
        </PressableScale>

        <PressableScale style={styles.actionBtn} onPress={handleLike}>
          <Animated.View style={[styles.actionCircle, { transform: [{ scale: likeScale }] }]}><Text style={styles.actionIcon}>{liked ? '❤️' : '🤍'}</Text></Animated.View>
          <Text style={styles.actionCount}>{formatCount(likeCount)}</Text>
        </PressableScale>

        <PressableScale style={styles.actionBtn} onPress={() => setShowComments(true)}>
          <View style={styles.actionCircle}><Text style={styles.actionIcon}>💬</Text></View>
          <Text style={styles.actionCount}>{formatCount(commentCount)}</Text>
        </PressableScale>

        <PressableScale style={styles.actionBtn} onPress={handleShare}>
          <View style={styles.actionCircle}><Text style={styles.actionIcon}>↗️</Text></View>
          <Text style={styles.actionCount}>Share</Text>
        </PressableScale>

        {isClient ? (
          <PressableScale style={styles.actionBtn} onPress={handleSave}>
            <View style={styles.actionCircle}><Text style={[styles.actionIcon, { color: saved ? colors.flash : colors.white }]}>★</Text></View>
            <Text style={[styles.actionCount, saved && { color: colors.flash }]}>{saved ? 'Saved' : 'Save'}</Text>
          </PressableScale>
        ) : (
          <PressableScale style={styles.actionBtn}>
            <View style={styles.actionCircle}><Text style={styles.actionIcon}>📊</Text></View>
            <Text style={styles.actionCount}>Stats</Text>
          </PressableScale>
        )}
      </Animated.View>

      <Animated.View style={[styles.bottomContent, { bottom: Platform.OS === 'ios' ? 106 : 78, opacity: contentOpacity }]}>
        <View style={styles.workerInfoRow}>
          {reel.profiles?.avatar_url ? (
            <Image source={{ uri: reel.profiles.avatar_url }} style={styles.workerAvatarImg} />
          ) : (
            <View style={[styles.workerAvatar, { backgroundColor: colors.primary }]}><Text style={styles.workerAvatarText}>{getInitials(workerName)[0]}</Text></View>
          )}
          <View style={styles.workerDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.workerName} numberOfLines={1}>{workerName}</Text>
              {isVerified && (<View style={styles.verifiedBadge}><Text style={styles.verifiedCheck}>✓</Text></View>)}
            </View>
            <Text style={styles.workerMeta} numberOfLines={1}>{category} · {location}</Text>
          </View>
        </View>
        {reel.description ? (<Text style={styles.caption} numberOfLines={2}>{reel.description}</Text>) : null}
        <View style={styles.typeBadgeRow}>
          <View style={[styles.typeBadge, { backgroundColor: reel.type === 'service' ? colors.primary + '20' : colors.flash + '20', borderColor: reel.type === 'service' ? colors.primary + '40' : colors.flash + '40' }]}>
            <Text style={[styles.typeBadgeText, { color: reel.type === 'service' ? colors.primary : colors.flash }]}>{reel.type === 'service' ? '🔧 Service' : '📦 Product'}</Text>
          </View>
        </View>
        {isClient && !isOwnReel && (
          <View style={styles.reelActionsRow}>
            {reel.type === 'product' ? (
              <PressableScale style={styles.bookNowBtn} onPress={handleOrderNow}>
                <Text style={styles.bookNowText}>🛍️  Order Now</Text>
              </PressableScale>
            ) : (
              <PressableScale style={styles.bookNowBtn} onPress={handleBookNow}>
                <Text style={styles.bookNowText}>📋  Book Now</Text>
              </PressableScale>
            )}
            <PressableScale style={styles.messageNowBtn} onPress={handleMessage}>
              <Text style={styles.messageNowText}>💬</Text>
            </PressableScale>
          </View>
        )}
        {!isClient && (<View style={styles.reelStatsRow}><View style={styles.reelStatChip}><Text style={styles.reelStatText}>❤ {formatCount(likeCount)} likes</Text></View><View style={styles.reelStatChip}><Text style={styles.reelStatText}>{timeAgo(reel.created_at)}</Text></View></View>)}
      </Animated.View>

      <CommentSheet visible={showComments} onClose={() => {
        setShowComments(false);
        supabase.from('reel_comments').select('id', { count: 'exact', head: true }).eq('reel_id', reel.id)
          .then(({ count }) => { if (count !== null) setCommentCount(count); });
      }} reelId={reel.id} userId={userId} />

      <ProductSheet
        visible={showProductSheet}
        onClose={() => setShowProductSheet(false)}
        workerId={reel.profiles?.id || ''}
        workerName={workerName}
        navigation={navigation}
      />
    </View>
  );
}


export default function ReelsScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { role, user } = useAuth();
  const isClient = role === 'client';
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [activeIndex, setActiveIndex] = useState(0);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Set when arriving from workspace search: open on that reel instead
  // of the top of the feed.
  const focusReelId: string | undefined = route?.params?.focusReelId;
  const listRef = useRef<FlatList<Reel>>(null);
  const focusHandledRef = useRef<string | null>(null);

  // Memoised and declared before the effect that runs it. Previously
  // the effect depended only on activeTab, so fetchReels kept whatever
  // `user` it closed over on first render — signing in did not refetch
  // the feed, and the "following" tab kept querying with a stale id.
  const fetchReels = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let query = supabase.from('reels')
        .select('id, video_url, thumbnail_url, description, type, likes, created_at, profiles(id, full_name, avatar_url, role, category, subcategory, location, verification_level)')
        .order('created_at', { ascending: false }).limit(50);
      if (activeTab === 'following' && user?.id) {
        const { data: followData } = await supabase.from('follows')
          .select('following_id').eq('follower_id', user.id).limit(FOLLOWING_FETCH_LIMIT);
        const followedIds = (followData || []).map((f: any) => f.following_id);
        if (followedIds.length > 0) { query = query.in('user_id', followedIds); }
        else { setReels([]); setLoading(false); return; }
      }
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      const formatted = (data || []).map((item: any) => ({ ...item, profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles }));
      setReels(formatted as Reel[]);
    } catch (err: any) { console.error('Fetch reels error:', err); setError(err.message || 'Failed to load reels'); }
    finally { setLoading(false); }
  }, [activeTab, user?.id]);

  useEffect(() => { fetchReels(); }, [fetchReels]);

  const onViewRef = useRef(({ viewableItems }: any) => { if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0); });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });
  // Runs once per requested id, after the feed has the reel in hand.
  // Silently does nothing when the reel isn't in this batch — it may be
  // older than the 50 the feed loads, and scrolling somewhere arbitrary
  // would be worse than staying put.
  useEffect(() => {
    if (!focusReelId || loading || focusHandledRef.current === focusReelId) return;
    const index = reels.findIndex(r => r.id === focusReelId);
    if (index > 0) {
      listRef.current?.scrollToIndex({ index, animated: false });
      setActiveIndex(index);
    }
    focusHandledRef.current = focusReelId;
  }, [focusReelId, loading, reels]);

  const renderReel = useCallback(({ item, index }: { item: Reel; index: number }) => {
    // Android has a hard limit on simultaneous hardware video decoders.
    // Without this, every reel that scrolled into FlatList's render
    // window stayed fully mounted with its own decoder instance -
    // scrolling through enough reels would exceed that limit and
    // crash. Only the current reel and its immediate neighbors get a
    // real <Video> (and the data queries ReelCard fires on mount);
    // everything else renders a lightweight placeholder that still
    // preserves scroll-snap positions.
    const withinWindow = Math.abs(index - activeIndex) <= 1;
    if (!withinWindow) {
      return <View style={{ height: SCREEN_H, backgroundColor: '#000' }} />;
    }
    return (
      <ReelCard reel={item} isClient={isClient} isActive={index === activeIndex && isFocused} userId={user?.id} navigation={navigation} />
    );
  }, [isClient, activeIndex, user, isFocused, navigation]);

  if (loading) return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Skeleton shimmer — looks like a reel is about to load */}
      <View style={styles.skeletonContainer}>
        <View style={styles.skeletonPulse}>
          <Animated.View style={[styles.skeletonShimmer, {
            transform: [{
              translateX: new Animated.Value(0),
            }],
          }]} />
        </View>
        {/* Skeleton action buttons */}
        <View style={styles.skeletonActions}>
          <View style={styles.skeletonCircle} />
          <View style={styles.skeletonCircle} />
          <View style={styles.skeletonCircle} />
          <View style={styles.skeletonCircle} />
        </View>
        {/* Skeleton bottom content */}
        <View style={styles.skeletonBottom}>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonAvatarSmall} />
            <View style={styles.skeletonLineLong} />
          </View>
          <View style={styles.skeletonLineMed} />
          <View style={styles.skeletonLineShort} />
        </View>
      </View>
      {/* Top tabs still visible during loading */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <View style={styles.tabRow}>
          <PressableScale>
            <Text style={[styles.tabText, styles.tabTextActive]}>For You</Text>
            <View style={styles.tabUnderline} />
          </PressableScale>
          <PressableScale>
            <Text style={styles.tabText}>Following</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );

  if (error) return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.errorFullScreen}>
        <View style={styles.errorIconCircle}>
          <Text style={styles.errorIconText}>!</Text>
        </View>
        <Text style={styles.errorTitle}>Could not load reels</Text>
        <Text style={styles.errorDesc}>{error}</Text>
        <PressableScale style={styles.retryBtn} onPress={fetchReels}>
          <Text style={styles.retryText}>Try Again</Text>
        </PressableScale>
      </View>
    </View>
  );

  if (reels.length === 0) return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.errorFullScreen}>
        <Text style={styles.emptyBigIcon}>{activeTab === 'following' ? '👥' : '🎬'}</Text>
        <Text style={styles.errorTitle}>
          {activeTab === 'following' ? 'No reels from people you follow' : 'No reels yet'}
        </Text>
        <Text style={styles.errorDesc}>
          {activeTab === 'following'
            ? 'Follow workers to see their reels here'
            : isClient
            ? 'Workers have not posted any reels yet.'
            : 'Create your first reel!'}
        </Text>
        {activeTab === 'following' && (
          <PressableScale style={styles.retryBtn} onPress={() => setActiveTab('foryou')}>
            <Text style={styles.retryText}>Browse For You</Text>
          </PressableScale>
        )}
      </View>
      <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <View style={styles.tabRow}>
          <PressableScale onPress={() => setActiveTab('foryou')}>
            <Text style={[styles.tabText, activeTab === 'foryou' && styles.tabTextActive]}>For You</Text>
            {activeTab === 'foryou' && <View style={styles.tabUnderline} />}
          </PressableScale>
          <PressableScale onPress={() => setActiveTab('following')}>
            <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>Following</Text>
            {activeTab === 'following' && <View style={styles.tabUnderline} />}
          </PressableScale>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <FlatList
        ref={listRef}
        data={reels}
        renderItem={renderReel}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_H}
        decelerationRate="fast"
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        getItemLayout={(_, index) => ({ length: SCREEN_H, offset: SCREEN_H * index, index })}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
        removeClippedSubviews={Platform.OS === 'android'}
      />
      <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <View style={styles.tabRow}>
          <PressableScale onPress={() => setActiveTab('foryou')}>
            <Text style={[styles.tabText, activeTab === 'foryou' && styles.tabTextActive]}>For You</Text>
            {activeTab === 'foryou' && <View style={styles.tabUnderline} />}
          </PressableScale>
          <PressableScale onPress={() => setActiveTab('following')}>
            <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>Following</Text>
            {activeTab === 'following' && <View style={styles.tabUnderline} />}
          </PressableScale>
        </View>
        {!isClient && (<PressableScale style={styles.createBtn}><Text style={styles.createBtnText}>+ Create</Text></PressableScale>)}
        {isClient && (<PressableScale style={styles.searchBtn}><Text style={styles.searchIcon}>🔍</Text></PressableScale>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  loadingText: { fontSize: 12, color: colors.textMuted, marginTop: 12 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  errorDesc: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontSize: 14, fontWeight: '700', color: colors.white },
  reelContainer: { width: SCREEN_W, position: 'relative', backgroundColor: colors.black },
  videoContainer: { flex: 1 },
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  pauseOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pauseIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  pauseText: { fontSize: 26, color: colors.white, marginLeft: 4 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgCard },
  errorEmoji: { fontSize: 48, marginBottom: 12, opacity: 0.5 },
  errorText: { fontSize: 14, color: colors.textMuted },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, zIndex: 10 },
  tabRow: { flexDirection: 'row', gap: 24, alignItems: 'center' },
  tabText: { fontSize: 16, fontWeight: '600', color: colors.white, opacity: 0.5, paddingBottom: 4, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  tabTextActive: { opacity: 1, fontWeight: '700' },
  tabUnderline: { height: 2.5, backgroundColor: colors.white, borderRadius: 2, marginTop: 2 },
  createBtn: { position: 'absolute', right: 20, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primary + '20', borderWidth: 1.5, borderColor: colors.primary + '50' },
  createBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  searchBtn: { position: 'absolute', right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '10', alignItems: 'center', justifyContent: 'center' },
  searchIcon: { fontSize: 16 },
  actionsColumn: { position: 'absolute', right: 10, alignItems: 'center', gap: 14, zIndex: 5 },
  actionAvatarContainer: { marginBottom: 4 },
  actionAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, borderColor: colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  actionAvatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  actionAvatarText: { fontSize: 16, fontWeight: '700', color: colors.white },
  actionAvatarPlus: { position: 'absolute', bottom: -4, left: 13, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.black },
  plusText: { fontSize: 11, fontWeight: '700', color: colors.white },
  actionBtn: { alignItems: 'center' },
  actionCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  actionIcon: { fontSize: 22, color: colors.white },
  actionCount: { fontSize: 10, fontWeight: '600', color: colors.white, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  bottomContent: { position: 'absolute', left: 0, right: 66, paddingHorizontal: 20, zIndex: 5 },
  workerInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  workerAvatarImg: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.white + '60', marginRight: 10 },
  workerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white + '60', marginRight: 10 },
  workerAvatarText: { fontSize: 15, fontWeight: '700', color: colors.white },
  workerDetails: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  workerName: { fontSize: 14, fontWeight: '700', color: colors.white, maxWidth: 200, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  verifiedBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.info, alignItems: 'center', justifyContent: 'center' },
  verifiedCheck: { fontSize: 8, fontWeight: '700', color: colors.white },
  workerMeta: { fontSize: 10, color: colors.white, opacity: 0.8, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  caption: { fontSize: 12, color: colors.white, lineHeight: 20, marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  typeBadgeRow: { flexDirection: 'row', marginBottom: 10 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  typeBadgeText: { fontSize: 11, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  reelActionsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  bookNowBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 28, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  messageNowBtn: { backgroundColor: 'rgba(255,255,255,0.2)', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  messageNowText: { fontSize: 18 },
  bookNowText: { fontSize: 14, fontWeight: '700', color: colors.white, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  reelStatsRow: { flexDirection: 'row', gap: 8 },
  reelStatChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.white + '20' },
  reelStatText: { fontSize: 10, fontWeight: '500', color: colors.white, opacity: 0.8 },
  errorIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  errorIconText: { fontSize: 24, color: colors.white, opacity: 0.4, marginLeft: 3 },
  errorTitle2: { fontSize: 15, fontWeight: '600', color: colors.white, opacity: 0.6, marginBottom: 4 },
  errorSubtext: { fontSize: 12, color: colors.white, opacity: 0.35, marginBottom: 16 },
  retryVideoBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 20 },
  retryVideoText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  // Skeleton loading
  skeletonContainer: { flex: 1, backgroundColor: '#0a0a0a' },
  skeletonPulse: { flex: 1, backgroundColor: '#111', overflow: 'hidden' },
  skeletonShimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1a1a1a', opacity: 0.5 },
  skeletonActions: { position: 'absolute', right: 14, bottom: Platform.OS === 'ios' ? 200 : 170, gap: 20, alignItems: 'center' },
  skeletonCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a' },
  skeletonBottom: { position: 'absolute', left: 20, right: 80, bottom: Platform.OS === 'ios' ? 110 : 82 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  skeletonAvatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', marginRight: 10 },
  skeletonLineLong: { width: 140, height: 14, borderRadius: 7, backgroundColor: '#1a1a1a' },
  skeletonLineMed: { width: 200, height: 10, borderRadius: 5, backgroundColor: '#151515', marginBottom: 8 },
  skeletonLineShort: { width: 100, height: 10, borderRadius: 5, backgroundColor: '#151515' },
  errorFullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyBigIcon: { fontSize: 48, marginBottom: 16, opacity: 0.6 },
});
