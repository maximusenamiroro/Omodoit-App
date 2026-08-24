import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Keyboard, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from '../../components/common/PressableScale';
import Avatar from '../../components/common/Avatar';
import Icon from '../../components/common/Icon';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  searchLiveWorkers, searchNewArrivals, searchReels,
  type LiveWorkerHit, type ProductHit, type ReelHit,
} from '../../lib/search';

// Search, as its own screen.
//
// The reels feed had a search button that did nothing — a PressableScale
// with no onPress. This is what it opens.
//
// It answers three questions a person actually has when they tap search
// from a feed of work: is there a reel about this, is there anyone doing
// this who is online right now, and is there anything like this for
// sale. Those are three different sources, so they are three sections
// rather than one merged list — a worker who is online and a product
// posted last month are not comparable results, and ranking them against
// each other would be inventing a relevance order that does not exist.
//
// Nothing here uses the 48-hour window the workspace panel applies. That
// window is right there, where the question is what appeared lately, and
// wrong here, where the question is whether the thing exists at all.

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

interface Results {
  reels: ReelHit[];
  workers: LiveWorkerHit[];
  arrivals: ProductHit[];
}

const EMPTY: Results = { reels: [], workers: [], arrivals: [] };

export default function SearchScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // The screen exists only to be typed into, so the keyboard comes up
  // without the user having to tap again. Delayed a frame because
  // focusing during the navigation animation is dropped on Android.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const trimmed = query.trim();
  const isSearching = trimmed.length >= MIN_QUERY_LENGTH;

  // Debounced so each keystroke is not its own round trip, and guarded
  // against stale responses: without the cancelled flag a slow query for
  // "sh" can land after the quick one for "shoe" and replace the right
  // answer with the wrong one.
  useEffect(() => {
    if (!isSearching) {
      setResults(EMPTY);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const [reels, workers, arrivals] = await Promise.all([
          searchReels(trimmed),
          searchLiveWorkers(trimmed),
          // Deliberately no recency cutoff, unlike the workspace panel.
          // Measured against live data on 2026-08-21: nothing at all had
          // been posted in the previous 48 hours, so a strict New
          // Arrivals filter returned zero rows for every possible query
          // while 22 products sat in the table. A section that is always
          // empty teaches people the search is broken. Results stay
          // ordered newest first, so anything genuinely new is still on
          // top the moment it exists.
          searchNewArrivals(trimmed, 30, 0),
        ]);
        if (!cancelled) setResults({ reels, workers, arrivals });
      } catch (err) {
        console.error('Search failed:', err);
        if (!cancelled) setResults(EMPTY);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [trimmed, isSearching]);

  // "Reels" is a TAB inside ClientNavigator / WorkerNavigator, while this
  // screen is a root stack screen. React Navigation resolves a bare route
  // name by walking UP to parent navigators, never down into a sibling
  // navigator's children — so navigate('Reels') from here matches nothing
  // and fails silently, which is exactly how it behaved. The nested form
  // addresses the tab through the stack route that contains it.
  //
  // ProductDetail and WorkerList below need no such treatment: they are
  // root stack screens, so a bare name finds them.
  const openReel = (reelId: string) => {
    navigation.navigate(role === 'client' ? 'ClientApp' : 'WorkerApp', {
      screen: 'Reels',
      params: { focusReelId: reelId },
    });
  };

  const openProduct = (hit: ProductHit) => {
    navigation.navigate('ProductDetail', {
      product: {
        id: hit.id, workerId: hit.workerId, type: hit.type, title: hit.title,
        description: hit.description, price: hit.price, imageUrl: hit.imageUrl,
        videoUrl: hit.videoUrl, category: hit.category,
        color: colors.primary, sellerName: hit.posterName,
      },
    });
  };

  const total = results.reels.length + results.workers.length + results.arrivals.length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </PressableScale>

        <View style={styles.field}>
          <Icon name="search" size={17} color={colors.textSecondary} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search reels, workers, products"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            autoCorrect={false}
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {query.length > 0 && (
            <PressableScale onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.clear}>✕</Text>
            </PressableScale>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!isSearching ? (
          <View style={styles.hint}>
            <Text style={styles.hintEmoji}>🔍</Text>
            <Text style={styles.hintTitle}>What are you looking for?</Text>
            <Text style={styles.hintSub}>
              Type at least {MIN_QUERY_LENGTH} letters. Search covers reels,
              workers who are online now, and everything on sale.
            </Text>
          </View>
        ) : searching && total === 0 ? (
          <View style={styles.hint}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : total === 0 ? (
          <View style={styles.hint}>
            <Text style={styles.hintEmoji}>🤔</Text>
            <Text style={styles.hintTitle}>Nothing found for “{trimmed}”</Text>
            <Text style={styles.hintSub}>Try a shorter word, or a trade like “tailor” or “plumber”.</Text>
          </View>
        ) : (
          <>
            {results.reels.length > 0 && (
              <>
                <Text style={styles.section}>🎬 Reels ({results.reels.length})</Text>
                {results.reels.map(hit => (
                  <PressableScale
                    key={hit.id}
                    style={styles.row}
                    onPress={() => openReel(hit.id)}
                  >
                    {hit.thumbnailUrl ? (
                      <Image source={{ uri: hit.thumbnailUrl }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbFallback]}>
                        <Text style={styles.thumbEmoji}>🎬</Text>
                      </View>
                    )}
                    <View style={styles.info}>
                      <Text style={styles.title} numberOfLines={1}>{hit.description || 'Untitled reel'}</Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        @{hit.posterName}{hit.category ? ` · ${hit.category}` : ''}
                      </Text>
                    </View>
                    <View style={styles.action}><Text style={styles.actionText}>Watch</Text></View>
                  </PressableScale>
                ))}
              </>
            )}

            {results.workers.length > 0 && (
              <>
                <Text style={styles.section}>🟢 Workers online ({results.workers.length})</Text>
                {results.workers.map(w => (
                  <PressableScale
                    key={w.id}
                    style={styles.row}
                    onPress={() => navigation.navigate('WorkerList', {
                      categoryName: w.category,
                      subcategoryName: w.subcategory || w.category,
                      color: colors.primary,
                    })}
                  >
                    <Avatar name={w.name} size={46} style={styles.thumb} />
                    <View style={styles.info}>
                      <Text style={styles.title} numberOfLines={1}>{w.name}</Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {w.subcategory || w.category} · online now
                      </Text>
                    </View>
                    <View style={[styles.action, styles.actionAccent]}>
                      <Text style={[styles.actionText, { color: colors.primary }]}>View</Text>
                    </View>
                  </PressableScale>
                ))}
              </>
            )}

            {results.arrivals.length > 0 && (
              <>
                <Text style={styles.section}>🆕 Products &amp; services ({results.arrivals.length})</Text>
                {results.arrivals.map(hit => (
                  <PressableScale key={hit.id} style={styles.row} onPress={() => openProduct(hit)}>
                    {hit.imageUrl ? (
                      <Image source={{ uri: hit.imageUrl }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbFallback]}>
                        <Text style={styles.thumbEmoji}>
                          {hit.videoUrl ? '🎬' : hit.type === 'service' ? '🛠️' : '📦'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.info}>
                      <Text style={styles.title} numberOfLines={1}>{hit.title}</Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        @{hit.posterName} · {hit.price != null ? `₦${hit.price.toLocaleString()}` : 'Price on request'}
                      </Text>
                    </View>
                    <View style={styles.action}>
                      <Text style={styles.actionText}>{hit.type === 'service' ? 'Book' : 'Order'}</Text>
                    </View>
                  </PressableScale>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.md, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgCard, borderRadius: 12,
    paddingHorizontal: 12, height: 42,
  },
  input: { flex: 1, color: colors.textPrimary, fontSize: 15, padding: 0 },
  clear: { color: colors.textSecondary, fontSize: 15, paddingHorizontal: 4 },

  body: { flex: 1 },
  bodyContent: { padding: spacing.md, paddingBottom: 40 },

  hint: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  hintEmoji: { fontSize: 40, marginBottom: 14 },
  hintTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  hintSub: {
    fontSize: 13, color: colors.textSecondary, textAlign: 'center',
    marginTop: 8, lineHeight: 19,
  },

  section: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    marginTop: 18, marginBottom: 8, letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: 14,
    padding: 10, marginBottom: 8,
  },
  thumb: { width: 46, height: 46, borderRadius: 10, marginRight: 12, backgroundColor: colors.bg },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 20 },
  info: { flex: 1, marginRight: 10 },
  title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  action: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  actionAccent: { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
});
