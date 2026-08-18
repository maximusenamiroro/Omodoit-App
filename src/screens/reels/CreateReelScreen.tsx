import React, { useEffect, useState } from 'react';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, StatusBar, Platform, Alert, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import PressableScale from '../../components/common/PressableScale';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { createThumbnail } from 'react-native-create-thumbnail';
import VideoTrim, { showEditor } from 'react-native-video-trim';
import Video from 'react-native-video';
import { uploadVideoToStorage, uploadReelThumbnail, toFileUri } from '../../lib/uploadImage';
import { ensureMediaPermission } from '../../lib/permissions';

// These MUST match the reels_type_check constraint on the database,
// which allows only 'service' and 'product' — the same two the website
// posts. This screen previously offered showcase/tutorial/promotion/
// behind, none of which are valid values, so every publish from mobile
// failed at the insert with a constraint violation. It read as a
// network error because the catch block showed a generic "check your
// connection" message, which is why it went unnoticed.
const REEL_TYPES = [
  { key: 'service', icon: '🛠️', label: 'Service', desc: 'A service you offer clients' },
  { key: 'product', icon: '📦', label: 'Product', desc: 'Something you sell' },
];

export default function CreateReelScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [reelType, setReelType] = useState('service');
  const [focused, setFocused] = useState('');
  const [publishing, setPublishing] = useState(false);
  // Compression runs before the upload starts and can take a few
  // seconds, so the button has to say which stage it's in — otherwise
  // it reads as a frozen app.
  const [publishStage, setPublishStage] = useState('');
  // Set once the clip has been through the trimmer, so the UI can say
  // so and the Trim button can read "Re-trim".
  const [trimmed, setTrimmed] = useState(false);

  // A reel is short by definition. Capping the trimmer rather than
  // rejecting long files afterwards means the user shortens their own
  // clip instead of being told to go and find a different one — and
  // it's what lets us encode at high quality without huge uploads,
  // since bitrate x duration is what actually costs megabytes.
  const MAX_REEL_SECONDS = 60;

  // Reels are watched on phones, usually on mobile data. 'high' capture
  // quality produced files up to 45MB for a clip of a few seconds —
  // slow to upload, slow to start playing, and every view of it is
  // metered bandwidth. 'medium' is visually indistinguishable at phone
  // size and lands roughly 3-5x smaller.
  const VIDEO_QUALITY = 'medium' as const;

  // This is a sanity limit, NOT the size we upload. On-device
  // compression at publish time is what actually gets files down (a
  // 55MB clip lands around 5-8MB), so rejecting at selection would
  // turn away perfectly normal phone videos before the thing that
  // fixes them ever runs. It only exists to stop someone picking a
  // feature-length file and waiting ten minutes to find out.
  const MAX_VIDEO_MB = 300;

  // The trimmer is a native screen, so its result arrives as an event
  // rather than a promise. Subscribe once for the life of the screen.
  useEffect(() => {
    const subs = [
      VideoTrim.onFinishTrimming?.(({ outputPath }: { outputPath: string }) => {
        // The trimmer returns a bare '/data/...' path while every other
        // module here returns 'file:///data/...'. Normalise once, at
        // the boundary, so the compressor, thumbnailer and uploader all
        // receive the same shape.
        setVideoUri(toFileUri(outputPath));
        setTrimmed(true);
      }),
      VideoTrim.onError?.(({ message }: { message: string }) => {
        console.warn('Trim failed:', message);
        Alert.alert('Could Not Trim', 'Your original clip is still selected and can be posted as-is.');
      }),
    ].filter(Boolean);

    return () => subs.forEach((s: any) => s?.remove?.());
  }, []);

  const openTrimmer = (uri: string) => {
    showEditor(uri, {
      // MILLISECONDS. Passing seconds here clamps the selectable range
      // to a fraction of a second and the drag handles simply refuse
      // to move, which looks like a broken trimmer rather than a bad
      // value.
      maxDuration: MAX_REEL_SECONDS * 1000,
      minDuration: 1000,

      // Deliberately OFF. This makes the trim a stream copy (-c copy):
      // the video is cut without being decoded and re-encoded at all,
      // so it is completely lossless.
      //
      // Turning it on gives a frame-exact cut but re-encodes — and
      // since we encode again below for quality/size, that would mean
      // TWO lossy passes over the same footage. Generational loss like
      // that is visible, and no bitrate setting afterwards can recover
      // detail already thrown away.
      //
      // The cost is that the cut lands on the nearest keyframe, so the
      // clip can start up to a second or so earlier than the handle.
      // That is a positioning inconvenience; double encoding is a
      // permanent quality tax. For a product competing on how good the
      // video looks, the trade goes this way.
      enablePreciseTrimming: false,

      // The trimmed file is ours to upload, not something to dump in
      // the user's camera roll.
      saveToPhoto: false,
      enableCancelDialog: false,
    });
  };

  const acceptVideo = (res: any) => {
    const asset = res.assets?.[0];
    if (!asset?.uri) return;

    const sizeMB = (asset.fileSize || 0) / (1024 * 1024);
    if (sizeMB > MAX_VIDEO_MB) {
      Alert.alert(
        'Video Too Large',
        `That video is ${sizeMB.toFixed(0)}MB, which is too big to process on your phone. ` +
        'Please pick a shorter clip.'
      );
      return;
    }
    setVideoUri(asset.uri);
    setTrimmed(false);
    // Straight into the trimmer. Trimming BEFORE compression matters:
    // otherwise the encoder spends time and quality on frames that are
    // about to be thrown away.
    openTrimmer(asset.uri);
  };

  const handleRecord = () => {
    launchCamera(
      { mediaType: 'video', videoQuality: VIDEO_QUALITY, durationLimit: 60 },
      (res) => {
        if (res.errorMessage) {
          Alert.alert('Camera Error', res.errorMessage);
          return;
        }
        acceptVideo(res);
      }
    );
  };

  const handleUpload = async () => {
    // Shared with the avatar and product pickers — see lib/permissions.
    if (!(await ensureMediaPermission('video'))) return;
    launchImageLibrary({ mediaType: 'video', videoQuality: VIDEO_QUALITY }, acceptVideo);
  };

  const handlePublish = async () => {
    if (!videoUri) {
      Alert.alert('Add a Video', 'Please record or upload a video first.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Please Log In', 'You need to be logged in to publish a reel.');
      return;
    }
    if (publishing) return;

    setPublishing(true);
    try {
      // ── 1. Compress on-device ────────────────────────────────
      // The phone's hardware encoder is free to us, and every
      // megabyte removed here is paid for again on every single view.
      // Raw camera clips ran 8.5MB on average and up to 45MB; 'auto'
      // targets ~720p and typically lands 3-5x smaller with no
      // visible difference at phone size.
      //
      // Deliberately non-fatal: if compression fails on some device or
      // codec, uploading the original is far better than refusing to
      // publish at all.
      setPublishStage('Preparing video…');
      let uploadUri = videoUri;
      try {
        // ONE encode, quality-targeted rather than size-targeted.
        //
        // This replaced react-native-compressor, which only exposes a
        // fixed bitrate. Fixed bitrate spends the same bits on a static
        // shot of a wall as on a fast pan, so detailed footage smears
        // while simple footage wastes space.
        //
        // CRF targets a visual quality level instead and lets the size
        // land where it must. 'high' is CRF 18 — the point generally
        // considered visually indistinguishable from the source. A
        // simple clip stays small; a complex one gets the bits it
        // actually needs.
        //
        // width/height/frameRate at -1 keep the original resolution and
        // frame rate, so 1080p60 footage stays 1080p60 instead of being
        // quietly downscaled.
        // Every field is passed explicitly. The TypeScript signature
        // takes a Partial, but the native function reads each key
        // directly and throws "Exception in HostFunction: bitrate" on
        // the first one missing — the types are more forgiving than
        // the implementation.
        //
        // bitrate: -1 is what selects the CRF quality preset above.
        // Setting an actual number here would override 'high' and put
        // us back on fixed-bitrate encoding.
        const result = await VideoTrim.compress(videoUri, {
          quality: 'high',
          bitrate: -1,
          width: -1,
          height: -1,
          frameRate: -1,
          outputExt: 'mp4',
          removeAudio: false,
        });
        if (result?.outputPath) uploadUri = toFileUri(result.outputPath);
      } catch (compressErr) {
        // Uploading the trimmed original is lossless, so a failure here
        // costs bandwidth, never quality.
        console.warn('Video encode failed, uploading trimmed original:', compressErr);
      }

      // ── 2. Poster frame ──────────────────────────────────────
      // Shown instantly in the feed while the video buffers. Taken at
      // 1s rather than 0 because the opening frame of a phone clip is
      // usually black or still focusing.
      let thumbnailUrl: string | null = null;

      // AVAssetImageGenerator needs a properly formed file:// URL — a
      // bare path fails with the unhelpful AVFoundation error -11800
      // ("unknown error -17913"). react-native-compressor returns a
      // plain path, so normalise before handing it over.
      const asFileUrl = (p: string) =>
        p.startsWith('file://') || p.startsWith('http') ? p : `file://${p}`;

      // Try the compressed file, then fall back to the original. They
      // are different encodings, and AVFoundation rejects some
      // containers outright — the Simulator especially, where it lacks
      // much of the hardware decoding a real device has. If one is
      // refused the other often isn't.
      const candidates = [...new Set([uploadUri, videoUri])];

      // Several timestamps, not one. A single unseekable frame was
      // enough to publish a reel with no poster at all, and a reel
      // without a poster is a black rectangle for as long as the video
      // takes to arrive. 1s first because the opening frame of a phone
      // clip is usually black or still focusing; 0 next because a very
      // short clip may not have a frame at 1s; then later frames for
      // clips that open on a fade.
      const stamps = [1000, 0, 2000, 500];

      outer: for (const candidate of candidates) {
        for (const timeStamp of stamps) {
          try {
            const thumb = await createThumbnail({
              url: asFileUrl(candidate),
              timeStamp,
              format: 'jpeg',
            });
            if (thumb?.path) {
              thumbnailUrl = await uploadReelThumbnail(thumb.path, user.id);
              break outer;
            }
          } catch (thumbErr) {
            console.warn(`Thumbnail failed at ${timeStamp}ms for`, candidate, thumbErr);
          }
        }
      }

      // Deliberately still publishes if every attempt failed. Losing a
      // worker's reel over a missing still frame would be a far worse
      // trade than a poster-less reel, and the backfill script can pick
      // up whatever slips through.
      if (!thumbnailUrl) {
        console.warn('Publishing reel without a poster; every thumbnail attempt failed');
      }

      // ── 3. Upload ────────────────────────────────────────────
      setPublishStage('Uploading…');
      const videoUrl = await uploadVideoToStorage(uploadUri, user.id);

      const { error } = await supabase.from('reels').insert({
        user_id: user.id,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        description: description.trim() || null,
        type: reelType,
        likes: 0,
      });

      if (error) {
        // The files are already in storage at this point. Without this,
        // a failed insert leaves an orphaned video and poster behind
        // that nothing references and nothing will ever clean up — the
        // reels_type_check failure did exactly that, twice.
        const toRemove = [videoUrl, thumbnailUrl]
          .filter(Boolean)
          .map(url => (url as string).split('/reels/')[1])
          .filter(Boolean)
          .map(p => decodeURIComponent(p));
        if (toRemove.length > 0) {
          try {
            await supabase.storage.from('reels').remove(toRemove);
          } catch (cleanupErr) {
            console.warn('Could not clean up orphaned upload:', cleanupErr);
          }
        }
        throw error;
      }

      Alert.alert(
        '🎉 Reel Published!',
        'Your reel is now live. Clients can discover you through it.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      console.error('Reel publish error:', err);
      // Show the real reason. A generic "something went wrong" gave no
      // way to tell a dead connection from a storage permission
      // problem from a bug in this screen.
      Alert.alert(
        'Could Not Publish',
        err?.message
          ? `${err.message}\n\nPlease check your connection and try again.`
          : 'Something went wrong uploading your reel. Please check your connection and try again.'
      );
    } finally {
      setPublishing(false);
      setPublishStage('');
    }
  };

  return (
    <KeyboardAvoidingView style={[st.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={st.header}>
        <PressableScale style={st.backBtn} onPress={() => navigation.goBack()}>
          <Text style={st.backText}>←</Text>
        </PressableScale>
        <Text style={st.headerTitle}>Create Reel</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}>

        {videoUri ? (
          <View style={st.videoPreview}>
            {/* The actual clip, looping and silent — you should be able
                to see what you're about to post instead of a tick and
                the words "Video Selected". */}
            <Video
              source={{ uri: videoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              repeat
              muted
              paused={false}
              // On Android react-native-video defaults to a SurfaceView,
              // which is punched through the window rather than composited
              // with the views around it — it paints OVER its siblings, so
              // the label and the Trim/Change buttons vanish and the area
              // reads as a blank black box. TextureView composites normally.
              // ReelsScreen does the same thing for the same reason.
              useTextureView={Platform.OS === 'android'}
              onError={(e: any) => console.warn('Preview playback error:', e?.error?.errorString || e)}
            />
            <View style={st.videoPreviewScrim} />

            <View style={st.videoPreviewOverlay}>
              <Text style={st.videoPreviewText}>
                {trimmed ? '✂️ Trimmed' : 'Preview'}
              </Text>

              {/* Re-openable: the trimmer runs automatically on
                  selection, but a first pass is rarely the final cut. */}
              <View style={st.videoPreviewActions}>
                <PressableScale
                  style={st.trimBtn}
                  onPress={() => openTrimmer(videoUri)}
                >
                  <Text style={st.trimBtnText}>✂️ {trimmed ? 'Re-trim' : 'Trim'}</Text>
                </PressableScale>
                <PressableScale
                  style={st.changeBtn}
                  onPress={() => { setVideoUri(null); setTrimmed(false); }}
                >
                  <Text style={st.videoPreviewChange}>Change</Text>
                </PressableScale>
              </View>
            </View>
          </View>
        ) : (
          <View style={st.videoUpload}>
            <View style={st.videoUploadCircle}>
              <Text style={st.videoUploadIcon}>🎥</Text>
            </View>
            <Text style={st.videoUploadTitle}>Record or Upload Video</Text>
            <Text style={st.videoUploadSub}>Max 60 seconds · Portrait mode recommended</Text>
            <View style={st.videoUploadBtns}>
              <PressableScale style={st.videoOptionBtn} onPress={handleRecord}>
                <Text style={st.videoOptionIcon}>📷</Text>
                <Text style={st.videoOptionText}>Record</Text>
              </PressableScale>
              <PressableScale style={st.videoOptionBtn} onPress={handleUpload}>
                <Text style={st.videoOptionIcon}>📁</Text>
                <Text style={st.videoOptionText}>Upload</Text>
              </PressableScale>
            </View>
          </View>
        )}

        <View style={st.form}>
          <Text style={st.sectionTitle}>Reel Type</Text>
          <View style={st.typeGrid}>
            {REEL_TYPES.map(type => (
              <PressableScale key={type.key}
                style={[st.typeCard, reelType === type.key && st.typeCardActive]}
                onPress={() => setReelType(type.key)}>
                <Text style={st.typeIcon}>{type.icon}</Text>
                <Text style={[st.typeLabel, reelType === type.key && st.typeLabelActive]}>{type.label}</Text>
                <Text style={st.typeDesc}>{type.desc}</Text>
              </PressableScale>
            ))}
          </View>

          <Text style={st.sectionTitle}>Description</Text>
          <TextInput style={[st.textArea, focused === 'desc' && st.inputFocused]}
            value={description} onChangeText={setDescription}
            placeholder="Describe your reel... Add hashtags to get discovered!"
            placeholderTextColor={colors.textMuted} multiline numberOfLines={4}
            textAlignVertical="top" maxLength={300}
            onFocus={() => setFocused('desc')} onBlur={() => setFocused('')} />
          <Text style={st.charCount}>{description.length}/300</Text>

          <View style={st.tipsCard}>
            <Text style={st.tipsTitle}>💡 Tips for great reels</Text>
            <Text style={st.tipItem}>• Show your actual work, not stock footage</Text>
            <Text style={st.tipItem}>• Keep it under 30 seconds for best engagement</Text>
            <Text style={st.tipItem}>• Film in good lighting and portrait mode</Text>
            <Text style={st.tipItem}>• Add a description with relevant hashtags</Text>
            <Text style={st.tipItem}>• Show before and after for maximum impact</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[st.bottomBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16 }]}>
        <PressableScale style={[st.publishBtn, publishing && { opacity: 0.6 }]} onPress={handlePublish} disabled={publishing}>
          {/* Compression on a long clip takes real time. A spinner
              beside the current stage makes a slow publish read as
              working rather than frozen. */}
          {publishing ? (
            <View style={st.publishBusyRow}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={st.publishBtnText}>{publishStage || 'Publishing…'}</Text>
            </View>
          ) : (
            <Text style={st.publishBtnText}>🚀 Publish Reel</Text>
          )}
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.screenPadding, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white + '08', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: colors.white, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  // Taller and 9:16-ish, so the preview matches the shape a reel is
  // actually watched in. overflow:hidden keeps the video inside the
  // rounded corners.
  videoPreview: {
    margin: spacing.screenPadding, height: 380, borderRadius: 16,
    backgroundColor: '#000', overflow: 'hidden',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  // Keeps the buttons legible over bright footage.
  videoPreviewScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  publishBusyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoPreviewOverlay: { alignItems: 'center', paddingBottom: 16 },
  videoPreviewText: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  videoPreviewChange: { fontSize: 11, color: colors.textMuted },
  videoPreviewActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  trimBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: colors.primary,
  },
  trimBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  changeBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoUpload: { margin: spacing.screenPadding, height: 220, backgroundColor: '#111', borderRadius: 16, borderWidth: 2, borderColor: colors.primary + '30', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  videoUploadCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  videoUploadIcon: { fontSize: 28 },
  videoUploadTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  videoUploadSub: { fontSize: 11, color: colors.textMuted, marginBottom: 16 },
  videoUploadBtns: { flexDirection: 'row', gap: 12 },
  videoOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgCard, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 8 },
  videoOptionIcon: { fontSize: 14 },
  videoOptionText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },

  form: { paddingHorizontal: spacing.screenPadding },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeCard: { width: '48%', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  typeCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  typeIcon: { fontSize: 22, marginBottom: 6 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  typeLabelActive: { color: colors.primary },
  typeDesc: { fontSize: 10, color: colors.textMuted, lineHeight: 14 },

  textArea: { backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontSize: 14, color: colors.textPrimary, minHeight: 80 },
  inputFocused: { borderColor: colors.primary + '50' },
  charCount: { fontSize: 10, color: colors.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 16 },

  tipsCard: { backgroundColor: colors.primary + '08', borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '20', padding: 16 },
  tipsTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 10 },
  tipItem: { fontSize: 11, color: colors.textSecondary, lineHeight: 20, paddingLeft: 4 },

  bottomBar: { paddingHorizontal: spacing.screenPadding, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  publishBtn: { height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  publishBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
