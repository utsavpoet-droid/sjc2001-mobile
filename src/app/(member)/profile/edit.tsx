import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { postUploadMultipart } from '@/features/content/api';
import { getMemberProfile, putMemberProfile } from '@/features/member/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

// ─── Photo picker card ────────────────────────────────────────────────────────

function PhotoPickerCard({
  label,
  uri,
  onPicked,
}: {
  label: string;
  uri: string;
  onPicked: (url: string) => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const [uploading, setUploading] = useState(false);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);

  const resolved = resolveBackendUrl(uri) ?? null;

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
      ]}>
      {resolved ? (
        <Image
          source={{ uri: resolved }}
          style={styles.pickerPreview}
          contentFit="cover"
          recyclingKey={resolved}
        />
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
  const [schoolPhotoUrl, setSchoolPhotoUrl] = useState('');
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('');
  const [familyPhoto1, setFamilyPhoto1] = useState('');
  const [familyPhoto2, setFamilyPhoto2] = useState('');
  const [familyPhoto3, setFamilyPhoto3] = useState('');

  useEffect(() => {
    if (!profileQuery.data) return;
    setTitle(profileQuery.data.title ?? '');
    setComments(profileQuery.data.comments ?? '');
    setSchoolPhotoUrl(profileQuery.data.schoolPhotoUrl ?? '');
    setCurrentPhotoUrl(profileQuery.data.currentPhotoUrl ?? '');
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
        schoolPhotoUrl,
        currentPhotoUrl,
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

      {/* Photos section */}
      <Card style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PHOTOS</Text>
        <View style={styles.photoRow}>
          <PhotoPickerCard
            label="School photo"
            uri={schoolPhotoUrl}
            onPicked={setSchoolPhotoUrl}
          />
          <PhotoPickerCard
            label="Current photo"
            uri={currentPhotoUrl}
            onPicked={setCurrentPhotoUrl}
          />
        </View>
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
