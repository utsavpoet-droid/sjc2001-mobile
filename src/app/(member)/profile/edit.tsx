import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getMemberProfile, putMemberProfile } from '@/features/member/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
    () => [familyPhoto1, familyPhoto2, familyPhoto3].map((item) => item.trim()).filter(Boolean),
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
      router.back();
    },
    onError: (error) => {
      Alert.alert('Unable to save profile', error instanceof Error ? error.message : 'Try again.');
    },
  });

  return (
    <Screen scroll>
      <BackLink label="Back to profile" />
      <SectionTitle
        eyebrow="Edit Profile"
        title="Update your member profile"
        subtitle="Title, message, and photo URLs can be updated here today. Native image picking can come next."
      />

      {profileQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      <Card style={styles.stack}>
        <Input value={title} onChangeText={setTitle} placeholder="Title or tagline" />
        <Input
          value={comments}
          onChangeText={setComments}
          placeholder="Your story or message"
          multiline
          style={styles.multilineInput}
        />
        <Text style={[styles.caption, { color: colors.textSecondary }]}>Photos can be updated with URLs today. Native photo picking is the next UX step.</Text>
        <Input value={schoolPhotoUrl} onChangeText={setSchoolPhotoUrl} placeholder="School photo URL" />
        <Input value={currentPhotoUrl} onChangeText={setCurrentPhotoUrl} placeholder="Current photo URL" />
        <Input value={familyPhoto1} onChangeText={setFamilyPhoto1} placeholder="Family photo URL 1" />
        <Input value={familyPhoto2} onChangeText={setFamilyPhoto2} placeholder="Family photo URL 2" />
        <Input value={familyPhoto3} onChangeText={setFamilyPhoto3} placeholder="Family photo URL 3" />
        <PrimaryButton busy={saveMutation.isPending} onPress={() => saveMutation.mutate()}>
          Save Profile
        </PrimaryButton>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.two,
  },
  multilineInput: {
    minHeight: 140,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
  caption: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
});
