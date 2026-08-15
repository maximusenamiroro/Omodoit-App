import { Alert, PermissionsAndroid, Platform } from 'react-native';

// Android 13 (API 33) replaced the single READ_EXTERNAL_STORAGE
// permission with per-media-type ones, and IGNORES the old permission
// entirely. An app that only declares the legacy one gets an empty
// media picker with no error at all — which reads as "there are no
// photos on this phone" rather than as a permissions problem.
//
// Declaring READ_MEDIA_IMAGES / READ_MEDIA_VIDEO in the manifest is
// necessary but not sufficient: they are runtime permissions and still
// have to be requested before the picker is opened.
//
// iOS needs nothing here — the system picker runs out of process and
// prompts on its own.

type MediaKind = 'photo' | 'video';

export async function ensureMediaPermission(kind: MediaKind = 'photo'): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const isModern = Number(Platform.Version) >= 33;
  const permission = isModern
    ? kind === 'video'
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO
      : PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

  try {
    if (await PermissionsAndroid.check(permission)) return true;

    const result = await PermissionsAndroid.request(permission);
    if (result === PermissionsAndroid.RESULTS.GRANTED) return true;

    const subject = kind === 'video' ? 'videos' : 'photos';
    Alert.alert(
      'Permission Needed',
      result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? `Omodoit needs access to your ${subject}. Enable it in Settings → Apps → Omodoit → Permissions.`
        : `Omodoit needs access to your ${subject} to continue.`
    );
    return false;
  } catch (err) {
    // A thrown permission check shouldn't silently block the user —
    // let the picker open and fail visibly instead.
    console.warn('Media permission check failed:', err);
    return true;
  }
}
