import { useQuery } from '@tanstack/react-query';
import { Link, type Href } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, GhostButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getMemberProfile } from '@/features/member/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

export default function MyProfileScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const user = useAuthStore((state) => state.user);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);

  const profileQuery = useQuery({
    queryKey: ['member-profile'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return getMemberProfile(token);
    },
  });

  const profile = profileQuery.data;
  const schoolPhoto = resolveBackendUrl(profile?.schoolPhotoUrl ?? null);
  const currentPhoto = resolveBackendUrl(profile?.currentPhotoUrl ?? null);
  const familyPhotos = (profile?.familyPhotos ?? [])
    .map((photo) => resolveBackendUrl(photo.photoUrl))
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const avatar = schoolPhoto ?? currentPhoto ?? user?.avatarUrl ?? null;

  return (
    <Screen scroll>
      <BackLink label="Back to profile" />
      <SectionTitle
        eyebrow="My Profile"
        title={user?.name ?? 'Your profile'}
        subtitle="A read view of the same profile story you share with the batch."
      />

      {profileQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      <Card style={styles.heroCard}>
        <View style={styles.identityRow}>
          {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} resizeMode="contain" /> : <View style={[styles.avatarFallback, { backgroundColor: colors.accentSoft }]} />}
          <View style={styles.identityText}>
            <Text style={[styles.title, { color: colors.text }]}>{profile?.title || user?.name || 'My Profile'}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}> 
              {profile?.comments || 'Add a short note about what you are up to and what you want the batch to know.'}
            </Text>
            <Link href={'/(member)/profile/edit' as Href} asChild>
              <GhostButton>Edit Profile</GhostButton>
            </Link>
          </View>
        </View>
      </Card>

      <View style={styles.photoRow}>
        <Card style={styles.photoCard}>
          <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>School photo</Text>
          {schoolPhoto ? <Image source={{ uri: schoolPhoto }} style={styles.photo} resizeMode="contain" /> : <Text style={[styles.emptyText, { color: colors.textMuted }]}>Not added yet</Text>}
        </Card>
        <Card style={styles.photoCard}>
          <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>Current photo</Text>
          {currentPhoto ? <Image source={{ uri: currentPhoto }} style={styles.photo} resizeMode="contain" /> : <Text style={[styles.emptyText, { color: colors.textMuted }]}>Not added yet</Text>}
        </Card>
      </View>

      <Card style={styles.familyCard}>
        <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>Family photos</Text>
        <View style={styles.familyGrid}>
          {familyPhotos.length > 0 ? familyPhotos.map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.familyPhoto} resizeMode="contain" />
          )) : <Text style={[styles.emptyText, { color: colors.textMuted }]}>No family photos added yet</Text>}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: Spacing.two,
  },
  identityRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  identityText: {
    flex: 1,
    gap: Spacing.two,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 24,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  photoRow: {
    gap: Spacing.three,
  },
  photoCard: {
    gap: Spacing.two,
  },
  photoLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  photo: {
    width: '100%',
    height: 220,
  },
  familyCard: {
    gap: Spacing.two,
  },
  familyGrid: {
    gap: Spacing.two,
  },
  familyPhoto: {
    width: '100%',
    height: 200,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
});
