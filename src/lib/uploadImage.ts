import { supabase } from '../api/supabase';

// Shared upload helper for Supabase Storage from React Native. Uses
// the fetch -> arrayBuffer path, which is the officially documented
// approach for RN (the more common fetch().blob() pattern used on web
// has had reliability issues in React Native's fetch implementation).
//
// Bucket names match what's already in real use on the website, which
// shares this same Supabase project: 'avatars', 'products', 'reels',
// 'messages'.

export type UploadBucket = 'avatars' | 'products' | 'reels' | 'messages';

export async function uploadImageToStorage(
  bucket: UploadBucket,
  localUri: string,
  userId: string,
  extHint = 'jpg'
): Promise<string> {
  const ext = (localUri.split('.').pop() || extHint).toLowerCase().split('?')[0];
  const fileName = `${Date.now()}.${ext}`;
  const path = `${userId}/${fileName}`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType, upsert: true });

  if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error('Failed to get uploaded file URL');

  return `${urlData.publicUrl}?t=${Date.now()}`;
}

// Video variant — same approach, but loads the entire file into memory
// before uploading (via arrayBuffer), which is fine for short reels
// (a few tens of MB) but isn't a true streaming upload. A longer-form
// video feature would want a chunked/resumable upload instead.
export async function uploadVideoToStorage(
  localUri: string,
  userId: string
): Promise<string> {
  const ext = (localUri.split('.').pop() || 'mp4').toLowerCase().split('?')[0];
  const fileName = `${Date.now()}.${ext}`;
  const path = `${userId}/${fileName}`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';

  const { error: uploadError } = await supabase.storage
    .from('reels')
    .upload(path, arrayBuffer, { contentType, upsert: true });

  if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

  const { data: urlData } = supabase.storage.from('reels').getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error('Failed to get uploaded file URL');

  return urlData.publicUrl;
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
