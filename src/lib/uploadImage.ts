import { supabase } from '../api/supabase';
import { getR2UploadTarget, putToR2 } from './r2';

// Shared upload helpers for Supabase Storage from React Native.
//
// Everything goes via fetch -> arrayBuffer. That is the approach
// storage-js documents for React Native; Blob, File and FormData all
// fail there. See uploadVideoToStorage for the details.
//
// Bucket names match what's already in real use on the website, which
// shares this same Supabase project: 'avatars', 'products', 'reels',
// 'messages'.

export type UploadBucket = 'avatars' | 'products' | 'reels' | 'messages';

// One year. Every file here is written to a unique, timestamped path
// and never modified in place, so it can be cached as long as we like —
// the default of one hour meant a returning user re-downloaded media
// they already had. Bandwidth out of Supabase is the metered resource,
// so the cheapest request is the one the browser never makes.
const IMMUTABLE_CACHE = '31536000';

// Different native modules hand back local paths in different shapes:
// react-native-image-picker and react-native-compressor return
// 'file:///data/...', while react-native-video-trim returns a bare
// '/data/...'. fetch() treats a bare path as a RELATIVE URL and tries
// to make a real network request, which fails with the thoroughly
// misleading "TypeError: Network request failed".
export function toFileUri(path: string): string {
  if (!path) return path;
  if (path.startsWith('file://') || path.startsWith('content://')) return path;
  return 'file://' + path;
}

export async function uploadImageToStorage(
  bucket: UploadBucket,
  localUri: string,
  userId: string,
  extHint = 'jpg'
): Promise<string> {
  const ext = (localUri.split('.').pop() || extHint).toLowerCase().split('?')[0];
  const fileName = `${Date.now()}.${ext}`;
  const path = `${userId}/${fileName}`;

  const response = await fetch(toFileUri(localUri));
  const arrayBuffer = await response.arrayBuffer();

  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType, upsert: true, cacheControl: IMMUTABLE_CACHE });

  if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error('Failed to get uploaded file URL');

  return `${urlData.publicUrl}?t=${Date.now()}`;
}

// Video variant.
//
// Buffers the whole file into an ArrayBuffer before uploading, which
// isn't a true streaming upload — but it is the ONLY approach that
// works here. storage-js documents this explicitly:
//
//   "For React Native, using either Blob, File or FormData does not
//    work as intended. Upload file using ArrayBuffer from base64 file
//    data instead."
//
// A previous version of this function passed FormData with a { uri }
// part to stream from disk. It looked correct and typechecked fine,
// but failed at runtime for exactly that reason. Do not reintroduce
// it without checking the storage-js release notes first.
//
// The memory cost is much smaller than it used to be: CreateReelScreen
// now compresses on-device before calling this, so a clip that arrived
// as 55MB is a few MB by the time it gets here.
export async function uploadVideoToStorage(
  localUri: string,
  userId: string
): Promise<string> {
  const ext = (localUri.split('.').pop() || 'mp4').toLowerCase().split('?')[0];
  const fileName = `${Date.now()}.${ext}`;
  const path = `${userId}/${fileName}`;

  const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';

  const response = await fetch(toFileUri(localUri));
  const arrayBuffer = await response.arrayBuffer();

  // Prefer R2. Reel video is the one thing in this app whose bandwidth
  // bill grows with every view rather than every upload, and R2 charges
  // nothing for egress where Supabase's free plan allows 5GB a month.
  //
  // Falls through to Supabase Storage when R2 is not configured, so this
  // is safe to ship before the Cloudflare side exists — and once the
  // secrets are set, uploads move over without a new app release.
  //
  // Deliberately only reached for video. See src/lib/r2.ts for why the
  // images stay where they are.
  try {
    const target = await getR2UploadTarget(ext, arrayBuffer.byteLength);
    if (target) {
      const publicUrl = await putToR2(arrayBuffer, target);
      // null means the PUT failed. Not worth losing the user's reel
      // over: fall through and use Supabase for this one upload.
      if (publicUrl) return publicUrl;
    }
  } catch (r2Err) {
    console.warn('R2 upload path unavailable, using Supabase Storage:', r2Err);
  }

  const { error: uploadError } = await supabase.storage
    .from('reels')
    .upload(path, arrayBuffer, { contentType, upsert: true, cacheControl: IMMUTABLE_CACHE });

  if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

  const { data: urlData } = supabase.storage.from('reels').getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error('Failed to get uploaded file URL');

  return urlData.publicUrl;
}

// Uploads an already-generated poster image for a reel. Kept separate
// from uploadImageToStorage because reel posters belong beside the
// video in the 'reels' bucket, and must NOT get the cache-busting
// query string that avatars need.
export async function uploadReelThumbnail(
  localUri: string,
  userId: string
): Promise<string> {
  const fileName = `${Date.now()}_thumb.jpg`;
  const path = `${userId}/${fileName}`;

  // ArrayBuffer for the same reason as the video above.
  const response = await fetch(toFileUri(localUri));
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('reels')
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: IMMUTABLE_CACHE,
    });

  if (error) throw new Error('Thumbnail upload failed: ' + error.message);

  const { data } = supabase.storage.from('reels').getPublicUrl(path);
  return data?.publicUrl || '';
}

// A product or service post can carry a short video instead of (or as
// well as) a photo. Lives in the 'products' bucket beside the image so
// the two share a lifecycle.
// Matches the products bucket's file_size_limit. Storage rejects an
// oversized upload with a 413 whose message says nothing useful, so this
// checks first and fails with something a worker can act on.
export const PRODUCT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export async function uploadProductVideo(
  localUri: string,
  userId: string
): Promise<string> {
  const ext = (localUri.split('.').pop() || 'mp4').toLowerCase().split('?')[0];
  const fileName = `${Date.now()}_video.${ext}`;
  const path = `${userId}/${fileName}`;
  const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';

  const response = await fetch(toFileUri(localUri));
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > PRODUCT_VIDEO_MAX_BYTES) {
    throw new Error(
      'This video is too large even after compression (' +
      Math.round(arrayBuffer.byteLength / (1024 * 1024)) + 'MB). Please choose a shorter clip.'
    );
  }

  const { error } = await supabase.storage
    .from('products')
    .upload(path, arrayBuffer, { contentType, upsert: true, cacheControl: IMMUTABLE_CACHE });

  if (error) throw new Error('Video upload failed: ' + error.message);

  const { data } = supabase.storage.from('products').getPublicUrl(path);
  return data?.publicUrl || '';
}

// Removes all previously uploaded files for this user in a bucket
// before uploading a new one — mirrors the website's avatar cleanup
// pattern so old, orphaned files don't accumulate in storage.
export async function clearOldUploads(bucket: UploadBucket, userId: string) {
  try {
    const { data: existingFiles } = await supabase.storage.from(bucket).list(userId);
    if (existingFiles && existingFiles.length > 0) {
      await supabase.storage.from(bucket).remove(existingFiles.map(f => `${userId}/${f.name}`));
    }
  } catch (err) {
    console.warn('Could not clear old uploads (non-fatal):', err);
  }
}
