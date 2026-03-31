import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, router, type Href } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getMobileMe } from '@/features/auth/api/auth-api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getMemberActivity, getMemberProfile } from '@/features/member/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

const quickLinks = [
  {
    href: '/(member)/settings' as Href,
    title: 'Settings',
    subtitle: 'Password, MFA, and session controls.',
    icon: 'settings' as const,
  },
  {
    href: '/(member)/polls' as Href,
    title: 'Polls',
    subtitle: 'Vote and keep an eye on reunion decisions.',
    icon: 'checkbox' as const,
  },
  {
    href: '/(member)/silver-jubilee' as Href,
    title: 'Silver Jubilee',
    subtitle: 'Schedule, moments, and reunion updates.',
    icon: 'sparkles' as const,
  },
];

export default function AccountScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const busy = useAuthStore((state) => state.busy);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);

  const meQuery = useQuery({
    queryKey: ['mobile-me', accessToken],
    queryFn: () => getMobileMe(accessToken ?? ''),
    enabled: !!accessToken,
  });

  const profileQuery = useQuery({
    queryKey: ['member-profile-preview'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return getMemberProfile(token);
    },
  });

  const activityQuery = useQuery({
    queryKey: ['member-activity-preview'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return getMemberActivity(token);
    },
  });

  const profile = meQuery.data ?? user;
  const memberProfile = profileQuery.data;
  const unseen = activityQuery.data?.unseen ?? 0;
  const schoolPhoto = resolveBackendUrl(memberProfile?.schoolPhotoUrl ?? null);
  const currentPhoto = resolveBackendUrl(memberProfile?.currentPhotoUrl ?? null);
  const heroPhoto = currentPhoto ?? schoolPhoto ?? profile?.avatarUrl ?? null;

  return (
    <Screen scroll>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <SectionTitle
            eyebrow="My Profile"
            title={profile?.name ?? 'My profile'}
            subtitle="Your reunion identity, settings, and member tools, redesigned for quick touch-first use."
          />
        </View>
        <Pressable
          onPress={() => router.push('/(member)/activity')}
          style={[styles.bellButton, { backgroundColor: colors.text, borderColor: colors.text }]}>
          <Ionicons name="notifications" size={20} color="#FFF7F1" />
          {unseen > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}> 
              <Text style={styles.badgeText}>{unseen > 9 ? '9+' : unseen}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {(meQuery.isLoading || profileQuery.isLoading || activityQuery.isLoading) ? <ActivityIndicator color={colors.accent} /> : null}

      <Card style={[styles.profileCard, { backgroundColor: colors.text, borderColor: colors.text }]}> 
        <Text style={styles.profileKicker}>Silver Circle member profile</Text>
        <View style={styles.heroRow}>
          <View style={styles.portraitColumn}>
            <View style={styles.portraitFrame}>
              {heroPhoto ? (
                <Image source={{ uri: heroPhoto }} style={styles.heroPhoto} resizeMode="contain" />
              ) : (
                <Ionicons name="person" size={42} color="#B6C0CC" />
              )}
            </View>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{profile?.name ?? 'Member'}</Text>
            <Text style={styles.profileMeta}>Member ID: {profile?.memberId ?? '-'}</Text>
            {memberProfile?.title ? <Text style={styles.profileMeta}>{memberProfile.title}</Text> : null}
            <Text style={styles.profileBody}>
              {memberProfile?.comments || 'Add your photos, family details, and message so your batchmates get the full story when they open your profile.'}
            </Text>
            <View style={styles.statusRow}>
              <View style={styles.statusBadgeWarm}>
                <Ionicons name="shield-checkmark" size={12} color="#F8E4DA" />
                <Text style={styles.statusTextWarm}>{profile?.totpEnabled ? 'MFA enabled' : 'MFA available'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Link href={'/(member)/profile' as Href} asChild>
            <Pressable>
              {({ pressed }) => (
                <View style={[styles.secondaryAction, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.16)', opacity: pressed ? 0.84 : 1 }]}>
                  <Text style={styles.secondaryActionText}>View Profile</Text>
                </View>
              )}
            </Pressable>
          </Link>
          <Link href={'/(member)/profile/edit' as Href} asChild>
            <PrimaryButton>Edit Profile</PrimaryButton>
          </Link>
        </View>
      </Card>

      <View style={styles.grid}>
        {quickLinks.map((item) => (
          <Pressable key={item.title} onPress={() => router.push(item.href)}>
            {({ pressed }) => (
              <Card style={[styles.quickCard, { backgroundColor: colors.surface }, { transform: [{ scale: pressed ? 0.988 : 1 }] }]}> 
                <View style={[styles.quickIconWrap, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name={item.icon} size={18} color={colors.accent} />
                </View>
                <View style={styles.quickCopy}>
                  <Text style={[styles.quickTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.quickSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Card>
            )}
          </Pressable>
        ))}
      </View>

      <PrimaryButton
        busy={busy}
        onPress={() =>
          Alert.alert('Sign out', 'Are you sure you want to end this mobile session?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
          ])
        }>
        Sign Out
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  headerTextWrap: {
    flex: 1,
  },
  bellButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: Fonts.rounded,
  },
  profileCard: {
    gap: Spacing.three,
    borderRadius: 32,
  },
  profileKicker: {
    color: '#EAD4C7',
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  portraitColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitFrame: {
    width: 136,
    height: 136,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
  },
  profileText: {
    flex: 1,
    gap: Spacing.one,
  },
  profileName: {
    color: '#FFF7F1',
    fontFamily: Fonts.rounded,
    fontSize: 28,
  },
  profileMeta: {
    color: '#D4DCE5',
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  profileBody: {
    color: '#EEF1F4',
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    marginTop: Spacing.one,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  statusBadgeWarm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusTextWarm: {
    color: '#F8E4DA',
    fontFamily: Fonts.rounded,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondaryAction: {
    minHeight: 54,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  secondaryActionText: {
    color: '#FFF7F1',
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  grid: {
    gap: Spacing.three,
  },
  quickCard: {
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  quickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCopy: {
    flex: 1,
    gap: 2,
  },
  quickTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 20,
  },
  quickSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
});
