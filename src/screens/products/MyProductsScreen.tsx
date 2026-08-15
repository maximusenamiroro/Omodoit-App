import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Image,
  StatusBar, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';

// Everything one worker has posted — services and products both. Two
// audiences share this screen:
//   * the worker themselves, arriving from their profile, who can delete
//   * a client, arriving from a worker's public profile, who can order
// It's the same list either way, so it's one screen rather than two that
// drift apart.
const PAGE_SIZE = 24;

interface ProductRow {
  id: string;
  type: 'service' | 'product';
  title: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  category: string | null;
}

export default function MyProductsScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const workerId: string = route.params?.workerId || user?.id;
  const workerName: string = route.params?.workerName || 'You';
  const isOwner = workerId === user?.id;

  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPage = useCallback(async (offset: number): Promise<ProductRow[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('id, type, title, description, price, image_url, video_url, category')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    return (data || []).map((p: any) => ({
      id: p.id,
      type: p.type === 'service' ? 'service' : 'product',
      title: p.title || 'Untitled',
      description: p.description || null,
      price: p.price != null ? Number(p.price) : null,
      imageUrl: p.image_url || null,
      videoUrl: p.video_url || null,
      category: p.category || null,
    }));
  }, [workerId]);

  const load = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    setReachedEnd(false);
    try {
      const rows = await fetchPage(0);
      setItems(rows);
      setReachedEnd(rows.length < PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load products:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [workerId, fetchPage]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (loading || loadingMore || reachedEnd) return;
    setLoadingMore(true);
    try {
      const rows = await fetchPage(items.length);
      setItems(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...rows.filter(r => !seen.has(r.id))];
      });
      setReachedEnd(rows.length < PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more products:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = (item: ProductRow) => {
    Alert.alert(
      'Delete this post?',
      `"${item.title}" will be removed from your profile and from New Arrivals. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              // Scoped to worker_id as well as id: RLS should already
              // enforce this, but a delete that quietly matched nothing
              // is better than one that quietly matched someone else's row.
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', item.id)
                .eq('worker_id', workerId);
              if (error) throw error;
              setItems(prev => prev.filter(p => p.id !== item.id));
            } catch (err) {
              console.error('Failed to delete product:', err);
              Alert.alert('Could Not Delete', 'Please check your connection and try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const open = (item: ProductRow) => {
    navigation.navigate('ProductDetail', {
      product: {
        id: item.id,
        workerId,
        type: item.type,
        title: item.title,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        videoUrl: item.videoUrl,
        category: item.category,
        color: colors.primary,
        sellerName: isOwner ? 'You' : workerName,
      },
    });
  };

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={st.backText}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle} numberOfLines={1}>
          {isOwner ? 'My Posts' : `${workerName}'s Posts`}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: Platform.OS === 'ios' ? 100 : 80 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={st.emptyBox}>
              <Text style={st.emptyEmoji}>📦</Text>
              <Text style={st.emptyTitle}>Nothing posted yet</Text>
              <Text style={st.emptySub}>
                {isOwner ? 'Post a service or product and it will show up here.' : 'This worker has not posted anything yet.'}
              </Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity style={st.row} onPress={() => open(item)} activeOpacity={0.85}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={st.thumb} />
              ) : (
                <View style={[st.thumb, st.thumbFallback]}>
                  <Text style={st.thumbEmoji}>{item.videoUrl ? '🎬' : item.type === 'service' ? '🛠️' : '📦'}</Text>
                </View>
              )}
              <View style={st.info}>
                <Text style={st.title} numberOfLines={1}>{item.title}</Text>
                <Text style={st.typeText}>{item.type === 'service' ? 'Service · Book' : 'Product · Order'}</Text>
                <Text style={st.price}>
                  {item.price != null ? `₦${item.price.toLocaleString()}` : 'Price on request'}
                </Text>
              </View>
              {isOwner && (
                <TouchableOpacity
                  style={st.deleteBtn}
                  onPress={() => remove(item)}
                  disabled={deletingId === item.id}
                  activeOpacity={0.7}
                >
                  <Text style={st.deleteText}>{deletingId === item.id ? '…' : '🗑'}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  row: {
    flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10,
    borderRadius: 14, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  thumb: { width: 52, height: 52, borderRadius: 12, marginRight: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white + '08' },
  thumbEmoji: { fontSize: 22 },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  typeText: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  price: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 3 },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  deleteText: { fontSize: 15 },

  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 12, opacity: 0.4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
