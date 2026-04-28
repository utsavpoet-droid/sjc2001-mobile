import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, FocalImage, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { postUploadMultipart } from '@/features/content/api';
import { getMemberProfile, putMemberProfile } from '@/features/member/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';
import { reportMobileError } from '@/lib/error-logging';

// ─── Timezone options (mobile) ────────────────────────────────────────────────
const MOBILE_TZ_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Auto (from country)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Zurich', label: 'Zurich (CET)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
  { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT)' },
  { value: 'UTC', label: 'UTC' },
];

// ─── Photo picker card ────────────────────────────────────────────────────────

function clampFocal(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function PhotoPickerCard({
  label,
  uri,
  focalX = 50,
  focalY = 50,
  onPicked,
  onFocalChange,
}: {
  label: string;
  uri: string;
  focalX?: number;
  focalY?: number;
  onPicked: (url: string) => void;
  onFocalChange?: (x: number, y: number) => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const [uploading, setUploading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const user = useAuthStore((state) => state.user);

  const resolved = resolveBackendUrl(uri) ?? null;

  useEffect(() => {
    setPreviewFailed(false);
  }, [resolved]);

  function logEditProfileImageError(failedUri: string) {
    void reportMobileError({
      source: 'mobile-image',
      screen: 'profile-edit',
      component: `photo-picker-${label.toLowerCase().replace(/\s+/g, '-')}`,
      message: 'Failed to load profile edit image preview',
      metadata: {
        uri: failedUri,
        label,
        profileMemberId: String(user?.memberId ?? ''),
        profileName: user?.name ?? null,
      },
    });
  }

  function handleFrameLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width !== frameSize.width || height !== frameSize.height) {
      setFrameSize({ width, height });
    }
  }

  function updateFocal(locationX: number, locationY: number) {
    if (!onFocalChange || frameSize.width <= 0 || frameSize.height <= 0) return;
    onFocalChange(
      clampFocal((locationX / frameSize.width) * 100),
      clampFocal((locationY / frameSize.height) * 100),
    );
  }

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library to pick a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const fileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
    const mimeType = asset.mimeType ?? 'image/jpeg';

    setUploading(true);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not signed in');
      const { url } = await postUploadMultipart(token, {
        uri: asset.uri,
        fileName,
        mimeType,
      });
      onFocalChange?.(50, 50);
      setPreviewFailed(false);
      onPicked(url);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Pressable
      onPress={pick}
      disabled={uploading}
      style={({ pressed }) => [
        styles.pickerCard,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
      onLayout={handleFrameLayout}
      onStartShouldSetResponder={() => Boolean(resolved && onFocalChange)}
      onMoveShouldSetResponder={() => Boolean(resolved && onFocalChange)}
      onResponderGrant={(event) => {
        updateFocal(event.nativeEvent.locationX, event.nativeEvent.locationY);
      }}
      onResponderMove={(event) => {
        updateFocal(event.nativeEvent.locationX, event.nativeEvent.locationY);
      }}>
      {resolved ? (
        <>
          <FocalImage
            uri={resolved}
            focalX={focalX}
            focalY={focalY}
            width={frameSize.width || 1}
            height={frameSize.height || 1}
            style={styles.pickerPreview}
            fallback={
              <View style={[styles.pickerPreview, styles.pickerErrorState, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.pickerErrorText}>Photo failed to load</Text>
              </View>
            }
            onError={() => {
              setPreviewFailed(true);
              logEditProfileImageError(resolved);
            }}
          />
          {!previewFailed && onFocalChange ? (
            <>
              <View
                pointerEvents="none"
                style={[
                  styles.focusMarker,
                  {
                    left: `${focalX}%`,
                    top: `${focalY}%`,
                  },
                ]}
              />
              <View pointerEvents="none" style={styles.dragHint}>
                <Text style={styles.dragHintText}>Drag to adjust framing</Text>
              </View>
            </>
          ) : null}
        </>
      ) : (
        <View style={[styles.pickerEmpty, { borderColor: colors.border }]}>
          <Ionicons name="image-outline" size={32} color={colors.textMuted} />
        </View>
      )}

      {/* Overlay: label + edit badge */}
      <View style={styles.pickerOverlay}>
        <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>{label}</Text>
        <View style={[styles.editBadge, { backgroundColor: colors.accent }]}>
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={resolved ? 'pencil' : 'add'} size={14} color="#fff" />
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['member-profile-edit'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return getMemberProfile(token);
    },
  });

  const [title, setTitle] = useState('');
  const [comments, setComments] = useState('');
  const [timezone, setTimezone] = useState('');
  const [schoolPhotoUrl, setSchoolPhotoUrl] = useState('');
  const [schoolPhotoFocalX, setSchoolPhotoFocalX] = useState(50);
  const [schoolPhotoFocalY, setSchoolPhotoFocalY] = useState(50);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('');
  const [currentPhotoFocalX, setCurrentPhotoFocalX] = useState(50);
  const [currentPhotoFocalY, setCurrentPhotoFocalY] = useState(50);
  const [familyPhoto1, setFamilyPhoto1] = useState('');
  const [familyPhoto2, setFamilyPhoto2] = useState('');
  const [familyPhoto3, setFamilyPhoto3] = useState('');

  useEffect(() => {
    if (!profileQuery.data) return;
    setTitle(profileQuery.data.title ?? '');
    setComments(profileQuery.data.comments ?? '');
    setTimezone(profileQuery.data.timezone ?? '');
    setSchoolPhotoUrl(profileQuery.data.schoolPhotoUrl ?? '');
    setSchoolPhotoFocalX(profileQuery.data.schoolPhotoFocalX ?? 50);
    setSchoolPhotoFocalY(profileQuery.data.schoolPhotoFocalY ?? 50);
    setCurrentPhotoUrl(profileQuery.data.currentPhotoUrl ?? '');
    setCurrentPhotoFocalX(profileQuery.data.currentPhotoFocalX ?? 50);
    setCurrentPhotoFocalY(profileQuery.data.currentPhotoFocalY ?? 50);
    setFamilyPhoto1(profileQuery.data.familyPhotos?.[0]?.photoUrl ?? '');
    setFamilyPhoto2(profileQuery.data.familyPhotos?.[1]?.photoUrl ?? '');
    setFamilyPhoto3(profileQuery.data.familyPhotos?.[2]?.photoUrl ?? '');
  }, [profileQuery.data]);

  const familyPhotos = useMemo(
    () =>
      [familyPhoto1, familyPhoto2, familyPhoto3].map((u) => u.trim()).filter(Boolean),
    [familyPhoto1, familyPhoto2, familyPhoto3],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return putMemberProfile(token, {
        title,
        comments,
        timezone,
        schoolPhotoUrl,
        schoolPhotoFocalX,
        schoolPhotoFocalY,
        currentPhotoUrl,
        currentPhotoFocalX,
        currentPhotoFocalY,
        familyPhotos,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['member-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['member-profile-preview'] });
      await queryClient.invalidateQueries({ queryKey: ['member-profile-edit'] });
      router.back();
    },
    onError: (error) => {
      Alert.alert('Unable to save', error instanceof Error ? error.message : 'Try again.');
    },
  });

  return (
    <Screen scroll>
      <BackLink label="Back to profile" />
      <SectionTitle
        eyebrow="Edit Profile"
        title="Update your profile"
        subtitle="Tell your batchmates your story — then, now, and your family."
      />

      {profileQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      {/* About section */}
      <Card style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ABOUT</Text>
        <Input value={title} onChangeText={setTitle} placeholder="Your title or tagline" />
        <Input
          value={comments}
          onChangeText={(t) => t.length <= 300 && setComments(t)}
          placeholder="Your message to the batch (max 300 chars)"
          multiline
          style={styles.multilineInput}
        />
        <Text style={[styles.charCount, { color: comments.length > 280 ? colors.danger : colors.textMuted }]}>
          {comments.length} / 300
        </Text>
      </Card>

      {/* Timezone section */}
      <Card style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TIMEZONE</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Used so reminders and timestamps make sense for where you live.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tzRow}>
          {MOBILE_TZ_OPTIONS.map((opt) => {
            const selected = timezone === opt.value;
            return (
              <Pressable
                key={opt.value || 'auto'}
                onPress={() => setTimezone(opt.value)}
                style={[
                  styles.tzChip,
                  { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent + '22' : 'transparent' },
                ]}
              >
                <Text style={[styles.tzChipText, { color: selected ? colors.accent : colors.textSecondary }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Card>

      {/* Photos section */}
      <Card style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PHOTOS</Text>
        <View style={styles.photoRow}>
          <PhotoPickerCard
            label="School photo"
            uri={schoolPhotoUrl}
            focalX={schoolPhotoFocalX}
            focalY={schoolPhotoFocalY}
            onPicked={setSchoolPhotoUrl}
            onFocalChange={(x, y) => {
              setSchoolPhotoFocalX(x);
              setSchoolPhotoFocalY(y);
            }}
          />
          <PhotoPickerCard
            label="Current photo"
            uri={currentPhotoUrl}
            focalX={currentPhotoFocalX}
            focalY={currentPhotoFocalY}
            onPicked={setCurrentPhotoUrl}
            onFocalChange={(x, y) => {
              setCurrentPhotoFocalX(x);
              setCurrentPhotoFocalY(y);
            }}
          />
        </View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>Drag the marker until the face sits where you want it cropped.</Text>
      </Card>

      {/* Family photos section */}
      <Card style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>FAMILY PHOTOS</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>Up to 3 photos</Text>
        <View style={styles.familyRow}>
          <PhotoPickerCard
            label="Family 1"
            uri={familyPhoto1}
            onPicked={setFamilyPhoto1}
          />
          <PhotoPickerCard
            label="Family 2"
            uri={familyPhoto2}
            onPicked={setFamilyPhoto2}
          />
          <PhotoPickerCard
            label="Family 3"
            uri={familyPhoto3}
            onPicked={setFamilyPhoto3}
          />
        </View>
      </Card>

      <PrimaryButton busy={saveMutation.isPending} onPress={() => saveMutation.mutate()}>
        Save Profile
      </PrimaryButton>
    </Screen>
  );
}

const PICKER_HALF = '48%';

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  multilineInput: {
    minHeight: 120,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    textAlign: 'right',
  },
  hint: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    marginTop: -Spacing.one,
  },
  tzRow: {
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  tzChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 6,
  },
  tzChipText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  familyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  // PhotoPickerCard
  pickerCard: {
    width: PICKER_HALF,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    aspectRatio: 3 / 4,
  },
  pickerPreview: {
    width: '100%',
    height: '100%',
  },
  pickerErrorState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerErrorText: {
    color: '#92400E',
    fontFamily: Fonts.rounded,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  pickerEmpty: {
    width: '100%',
    height: '100%',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  focusMarker: {
    position: 'absolute',
    width: 26,
    height: 26,
    marginLeft: -13,
    marginTop: -13,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(15,23,42,0.3)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dragHint: {
    position: 'absolute',
    left: 10,
    bottom: 40,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dragHintText: {
    color: '#FFFFFF',
    fontFamily: Fonts.sans,
    fontSize: 10,
  },
  pickerLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    flex: 1,
  },
  editBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
