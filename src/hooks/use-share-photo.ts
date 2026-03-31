import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

/**
 * Downloads a remote image to the local cache then opens the native share sheet.
 * Returns `{ share, sharing }` — `sharing` is true while the download is in flight.
 */
export function useSharePhoto() {
  const [sharing, setSharing] = useState(false);

  const share = useCallback(async (uri: string) => {
    if (!uri || sharing) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing not available', 'Your device does not support sharing.');
      return;
    }

    setSharing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Derive a file extension from the URL (default jpg)
      const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg';
      const localUri = `${FileSystem.cacheDirectory}sjc_shared.${safeExt}`;
      await FileSystem.downloadAsync(uri, localUri);
      await Sharing.shareAsync(localUri, { mimeType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}` });
    } catch {
      Alert.alert('Could not share photo', 'Try again in a moment.');
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  return { share, sharing };
}
