import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, type Href } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getNews } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';

const silverCircleLogo = require('../../../../assets/branding/silver-circle-25.png');

const shortcuts = [
  {
    href: '/(member)/(tabs)/members' as Href,
    title: 'Batchmates',
    copy: 'Browse the circle, open contact cards, and jump straight into profile stories.',
    icon: 'people' as const,
    tone: 'warm',
  },
  {
    href: '/(member)/(tabs)/stories' as Href,
    title: 'Stories',
    copy: 'Follow what classmates are sharing, reacting to, and talking about now.',
    icon: 'chatbubbles' as const,
    tone: 'cool',
  },
  {
    href: '/(member)/(tabs)/gallery' as Href,
    title: 'Gallery',
    copy: 'Open albums, revisit memories, and move through reunion moments visually.',
    icon: 'images' as const,
    tone: 'neutral',
  },
  {
    href: '/(member)/polls' as Href,
    title: 'Polls',
    copy: 'Vote quickly and keep up with where the batch is leaning.',
    icon: 'checkbox' as const,
    tone: 'warm',
  },
  {
    href: '/(member)/silver-jubilee' as Href,
    title: 'Silver Jubilee',
    copy: 'Your reunion schedule, event updates, and must-know highlights.',
    icon: 'sparkles' as const,
    tone: 'cool',
  },
  {
    href: '/(member)/(tabs)/account' as Href,
    title: 'My Profile',
    copy: 'Update your photos, message, settings, and personal member space.',
    icon: 'person-circle' as const,
    tone: 'neutral',
  },
];

export default function HomeScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const user = useAuthStore((state) => state.user);
  const firstName = user?.name?.split(' ')[0] ?? 'friend';
  const newsQuery = useQuery({
    queryKey: ['news-home'],
    queryFn: () => getNews(),
  });
  const newsItems = Array.isArray(newsQuery.data) ? newsQuery.data.slice(0, 4) : [];

  function formatNewsDate(value: unknown) {
    if (typeof value !== 'string' || !value) return '';
    try {
      return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  return (
    <Screen scroll>
      <SectionTitle
        eyebrow="Silver Circle"
        title={`Welcome, ${firstName}!`}
        subtitle="25 years of friendships, memories, and milestones. Join us in celebrating the Class of 2001."
      />

      <Card style={[styles.heroCard, { backgroundColor: colors.text, borderColor: colors.text }]}> 
        <View style={styles.heroTopRow}>
          <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Ionicons name="sparkles" size={13} color="#F6D0B8" />
            <Text style={styles.heroBadgeText}>Silver Circle</Text>
          </View>
          <Text style={styles.heroYear}>Class of 2001</Text>
        </View>
        <Image source={silverCircleLogo} style={styles.logo} resizeMode="contain" />
      </Card>

      <Card style={[styles.featureCard, { backgroundColor: colors.accent, borderColor: colors.accent }]}> 
        <Text style={styles.featureKicker}>This season</Text>
        <Text style={styles.featureTitle}>Reconnect with the people behind the memories.</Text>
      </Card>

      <Card style={[styles.newsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.newsHeader}>
          <Text style={[styles.newsTitle, { color: colors.text }]}>News</Text>
          <Ionicons name="newspaper-outline" size={18} color={colors.accent} />
        </View>
        <View style={styles.newsList}>
          {newsItems.map((item, index) => {
            const article = item as { id?: number; title?: string | null; publishedAt?: string | null };
            return (
              <View key={String(article.id ?? index)} style={[styles.newsRow, index < newsItems.length - 1 ? { borderBottomColor: colors.border } : null]}>
                <Text style={[styles.newsDate, { color: colors.accent }]}>{formatNewsDate(article.publishedAt)}</Text>
                <Text style={[styles.newsHeadline, { color: colors.text }]} numberOfLines={2}>
                  {article.title || 'Update from the circle'}
                </Text>
              </View>
            );
          })}
          {!newsQuery.isLoading && newsItems.length === 0 ? (
            <Text style={[styles.newsEmpty, { color: colors.textSecondary }]}>No news has been published yet.</Text>
          ) : null}
        </View>
      </Card>

      <View style={styles.grid}>
        {shortcuts.map((item) => {
          const warm = item.tone === 'warm';
          const cool = item.tone === 'cool';
          return (
            <Link key={item.title} href={item.href} asChild>
              <Pressable>
                {({ pressed }) => (
                  <Card
                    style={[
                      styles.shortcutCard,
                      warm ? { backgroundColor: colors.surface } : cool ? { backgroundColor: colors.backgroundSoft } : { backgroundColor: colors.surfaceMuted },
                      { transform: [{ scale: pressed ? 0.985 : 1 }] },
                    ]}>
                    <View style={styles.shortcutHeader}>
                      <View
                        style={[
                          styles.shortcutIconWrap,
                          { backgroundColor: warm ? colors.accentSoft : colors.backgroundElement },
                        ]}>
                        <Ionicons name={item.icon} size={18} color={warm ? colors.accent : colors.text} />
                      </View>
                      <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
                    </View>
                    <Text style={[styles.shortcutTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.shortcutCopy, { color: colors.textSecondary }]}>{item.copy}</Text>
                  </Card>
                )}
              </Pressable>
            </Link>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    borderRadius: 32,
    borderWidth: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: '#F8E9DE',
    fontFamily: Fonts.rounded,
    fontSize: 12,
  },
  heroYear: {
    color: '#E9D6C8',
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  logo: {
    width: '100%',
    height: 220,
    alignSelf: 'center',
  },
  featureCard: {
    borderRadius: 28,
    gap: Spacing.two,
  },
  newsCard: {
    borderRadius: 28,
    gap: Spacing.two,
  },
  newsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
  },
  newsList: {
    gap: Spacing.two,
  },
  newsRow: {
    gap: 6,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
  },
  newsDate: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  newsHeadline: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  newsEmpty: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  featureKicker: {
    color: '#FFF0E9',
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  featureTitle: {
    color: '#FFFFFF',
    fontFamily: Fonts.rounded,
    fontSize: 24,
    lineHeight: 30,
  },
  featureTitleAlt: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
    lineHeight: 28,
  },
  grid: {
    gap: Spacing.three,
  },
  shortcutCard: {
    gap: Spacing.two,
    borderRadius: 28,
  },
  shortcutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shortcutIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 24,
  },
  shortcutCopy: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
});
