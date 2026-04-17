import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, type Href } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getBirthdays, getNews, type BirthdayEntry } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const silverCircleLogo = require('../../../../assets/branding/silver-circle-25.png');
const SW = Dimensions.get('window').width;

// ─── Birthday strip ───────────────────────────────────────────────────────────

const BDAY_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function BirthdayStrip({
  entries,
  colors,
}: {
  entries: BirthdayEntry[];
  colors: (typeof Colors)[keyof typeof Colors];
}) {
  if (entries.length === 0) return null;

  const todayList = entries.filter((b) => b.isToday);
  const upcomingList = entries.filter((b) => !b.isToday);

  function bdayLabel(b: BirthdayEntry): string {
    const [mm, dd] = b.birthday.split('-');
    const month = BDAY_MONTHS[parseInt(mm, 10) - 1] ?? '';
    return `${month} ${parseInt(dd, 10)}`;
  }

  return (
    <View style={[birthdayStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={birthdayStyles.header}>
        <Text style={[birthdayStyles.heading, { color: colors.text }]}>🎂 Birthdays</Text>
        <Text style={[birthdayStyles.sub, { color: colors.textMuted }]}>Next 60 days</Text>
      </View>

      {/* Today banners */}
      {todayList.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push(`/(member)/members/${b.id}` as Href);
          }}
          style={({ pressed }) => [
            birthdayStyles.todayBanner,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <LinearGradient
            colors={['#6d28d9', '#db2777', '#ea580c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={birthdayStyles.todayGradient}
          >
            <View style={birthdayStyles.todayAvatarWrap}>
              {b.photoUrl ? (
                <Image
                  source={{ uri: resolveBackendUrl(b.photoUrl) ?? b.photoUrl }}
                  style={birthdayStyles.todayAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[birthdayStyles.todayAvatar, birthdayStyles.todayAvatarFallback]}>
                  <Text style={birthdayStyles.todayInitials}>
                    {b.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                  </Text>
                </View>
              )}
              <Text style={birthdayStyles.todayCake}>🎂</Text>
            </View>
            <View style={birthdayStyles.todayInfo}>
              <Text style={birthdayStyles.todayName}>{b.name}</Text>
              <Text style={birthdayStyles.todayWish}>Happy Birthday! 🥳</Text>
            </View>
          </LinearGradient>
        </Pressable>
      ))}

      {/* Upcoming horizontal scroll */}
      {upcomingList.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={birthdayStyles.scroll}>
          {upcomingList.map((b) => {
            const soon = b.daysUntil <= 7;
            const resolvedPhoto = b.photoUrl ? resolveBackendUrl(b.photoUrl) ?? b.photoUrl : null;
            return (
              <Pressable
                key={b.id}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/(member)/members/${b.id}` as Href);
                }}
                style={({ pressed }) => [
                  birthdayStyles.chip,
                  {
                    backgroundColor: soon ? colors.accentSoft : colors.backgroundSoft,
                    borderColor: soon ? colors.accent : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={birthdayStyles.chipAvatarWrap}>
                  {resolvedPhoto ? (
                    <Image
                      source={{ uri: resolvedPhoto }}
                      style={birthdayStyles.chipAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[birthdayStyles.chipAvatar, { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={[birthdayStyles.chipInitials, { color: colors.accent }]}>
                        {b.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </Text>
                    </View>
                  )}
                  {soon && <Text style={birthdayStyles.chipBalloon}>🎈</Text>}
                </View>
                <Text style={[birthdayStyles.chipName, { color: colors.text }]} numberOfLines={1}>{b.name.split(' ')[0]}</Text>
                <Text style={[birthdayStyles.chipDate, { color: colors.textMuted }]}>{bdayLabel(b)}</Text>
                <Text style={[birthdayStyles.chipDays, { color: soon ? colors.accent : colors.textMuted }]}>
                  {b.daysUntil === 1 ? 'Tomorrow' : `${b.daysUntil}d`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const birthdayStyles = StyleSheet.create({
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
  },
  sub: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  todayBanner: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  todayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 20,
  },
  todayAvatarWrap: {
    position: 'relative',
  },
  todayAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  todayAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayInitials: {
    color: '#fff',
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  todayCake: {
    position: 'absolute',
    bottom: -4,
    right: -6,
    fontSize: 18,
  },
  todayInfo: {
    flex: 1,
    gap: 4,
  },
  todayName: {
    color: '#fff',
    fontFamily: Fonts.rounded,
    fontSize: 18,
    lineHeight: 22,
  },
  todayWish: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  scroll: {
    marginHorizontal: -Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  chip: {
    width: 90,
    marginRight: Spacing.two,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.two,
    alignItems: 'center',
    gap: 4,
  },
  chipAvatarWrap: {
    position: 'relative',
  },
  chipAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  chipInitials: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  chipBalloon: {
    position: 'absolute',
    top: -6,
    right: -8,
    fontSize: 14,
  },
  chipName: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  chipDate: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  chipDays: {
    fontFamily: Fonts.rounded,
    fontSize: 11,
  },
});

// ─── Greeting helper ─────────────────────────────────────────────────────────

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatNewsDate(value: unknown) {
  if (typeof value !== 'string' || !value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// ─── Shortcut tile ────────────────────────────────────────────────────────────

type Tone = 'warm' | 'cool' | 'muted';

function ShortcutTile({
  href,
  icon,
  title,
  tone,
  colors,
}: {
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tone: Tone;
  colors: (typeof Colors)[keyof typeof Colors];
}) {
  const bgMap: Record<Tone, string> = {
    warm: colors.accentSoft,
    cool: colors.accentSoft,
    muted: colors.accentSoft,
  };
  const iconColorMap: Record<Tone, string> = {
    warm: colors.accent,
    cool: colors.accent,
    muted: colors.accent,
  };

  return (
    <Link href={href} asChild>
      <Pressable
        onPress={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: colors.surface, borderColor: colors.border },
          { transform: [{ scale: pressed ? 0.96 : 1 }] },
        ]}>
        <View style={[styles.tileIcon, { backgroundColor: bgMap[tone] }]}> 
          <Ionicons name={icon} size={22} color={iconColorMap[tone]} />
        </View>
        <Text style={[styles.tileTitle, { color: colors.text }]}>{title}</Text>
      </Pressable>
    </Link>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

const shortcuts: {
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tone: Tone;
}[] = [
  { href: '/(member)/(tabs)/members' as Href, icon: 'people', title: 'Members', tone: 'warm' },
  { href: '/(member)/(tabs)/stories' as Href, icon: 'chatbubbles', title: 'Stories', tone: 'cool' },
  { href: '/(member)/(tabs)/gallery' as Href, icon: 'images', title: 'Gallery', tone: 'muted' },
  { href: '/(member)/polls' as Href, icon: 'checkbox', title: 'Polls', tone: 'warm' },
  { href: '/(member)/silver-jubilee' as Href, icon: 'sparkles', title: 'Jubilee', tone: 'cool' },
  { href: '/(member)/(tabs)/account' as Href, icon: 'person-circle', title: 'Profile', tone: 'muted' },
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

  const birthdaysQuery = useQuery({
    queryKey: ['birthdays-home'],
    queryFn: async () => {
      const token = await useAuthStore.getState().getValidAccessToken();
      if (!token) return { birthdays: [] };
      return getBirthdays(token);
    },
  });
  const birthdayEntries: BirthdayEntry[] = birthdaysQuery.data?.birthdays ?? [];
  type NewsItem = { id?: number; title?: string | null; body?: string | null; publishedAt?: string | null };
  const featuredNews = newsItems[0] as NewsItem | undefined;
  const restNews = (newsItems.slice(1) as NewsItem[]);

  return (
    <Screen scroll>

      {/* ── GREETING ──────────────────────────────────────────────── */}
      <View style={styles.greetingBlock}>
        <Text style={[styles.greetingEyebrow, { color: colors.accent }]}>SILVER CIRCLE</Text>
        <Text style={[styles.greetingTitle, { color: colors.text }]}>
          {timeGreeting()}, {firstName}!
        </Text>
        <Text style={[styles.greetingSubtitle, { color: colors.textSecondary }]}>
          Class of 2001 · Silver Jubilee
        </Text>
      </View>

      {/* ── HERO BANNER ───────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1C0F07', '#2E1508', '#5C2810']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBanner}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color="#F6D0B8" />
            <Text style={styles.heroBadgeText}>Silver Circle</Text>
          </View>
          <Text style={styles.heroYear}>Class of 2001</Text>
        </View>

        <Image
          source={silverCircleLogo}
          style={styles.heroLogo}
          contentFit="contain"
        />

        <Text style={styles.heroTagline}>
          25 years of friendships, memories, and milestones.
        </Text>

        {/* Primary CTAs inside hero */}
        <View style={styles.heroCtas}>
          <Link href={'/(member)/(tabs)/members' as Href} asChild>
            <Pressable
              onPress={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={({ pressed }) => [styles.heroCtaButton, { opacity: pressed ? 0.8 : 1 }]}>
              <Ionicons name="people" size={16} color="#FFF7F1" />
              <Text style={styles.heroCtaText}>Batchmates</Text>
            </Pressable>
          </Link>
          <Link href={'/(member)/(tabs)/stories' as Href} asChild>
            <Pressable
              onPress={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={({ pressed }) => [
                styles.heroCtaButton,
                styles.heroCtaOutline,
                { opacity: pressed ? 0.8 : 1 },
              ]}>
              <Ionicons name="chatbubbles" size={16} color="#F6D0B8" />
              <Text style={[styles.heroCtaText, { color: '#F6D0B8' }]}>Stories</Text>
            </Pressable>
          </Link>
        </View>
      </LinearGradient>

      {/* ── BIRTHDAYS ─────────────────────────────────────────────── */}
      {birthdayEntries.length > 0 && (
        <BirthdayStrip entries={birthdayEntries} colors={colors} />
      )}

      {/* ── NEWS ──────────────────────────────────────────────────── */}
      {(newsItems.length > 0 || newsQuery.isLoading) ? (
        <View style={[styles.newsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.newsHeader}>
            <Text style={[styles.newsHeading, { color: colors.text }]}>News</Text>
            <Ionicons name="newspaper-outline" size={18} color={colors.accent} />
          </View>

          {/* Featured item */}
          {featuredNews ? (
            <Pressable
              onPress={() => featuredNews.id && router.push(`/(member)/news/${featuredNews.id}` as Href)}
              style={({ pressed }) => [
                styles.newsFeatured,
                { backgroundColor: colors.backgroundSoft, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
              ]}>
              <Text style={[styles.newsFeaturedDate, { color: colors.accent }]}>
                {formatNewsDate(featuredNews.publishedAt)}
              </Text>
              <Text style={[styles.newsFeaturedTitle, { color: colors.text }]} numberOfLines={3}>
                {featuredNews.title || 'Update from the circle'}
              </Text>
            </Pressable>
          ) : null}

          {/* Rest as compact rows */}
          {restNews.map((item, i) => (
            <Pressable
              key={String(item.id ?? i)}
              onPress={() => item.id && router.push(`/(member)/news/${item.id}` as Href)}
              style={({ pressed }) => [
                styles.newsRow,
                i < restNews.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                { opacity: pressed ? 0.88 : 1 },
              ]}>
              <Text style={[styles.newsRowDate, { color: colors.accent }]}>
                {formatNewsDate(item.publishedAt)}
              </Text>
              <Text style={[styles.newsRowTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title || 'Update from the circle'}
              </Text>
            </Pressable>
          ))}

          {!newsQuery.isLoading && newsItems.length === 0 ? (
            <Text style={[styles.newsEmpty, { color: colors.textSecondary }]}>
              No news has been published yet.
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── QUICK ACCESS GRID ─────────────────────────────────────── */}
      <View style={styles.gridSection}>
        <Text style={[styles.gridLabel, { color: colors.textMuted }]}>QUICK ACCESS</Text>
        <View style={styles.grid}>
          {shortcuts.map((item) => (
            <ShortcutTile key={item.title} {...item} colors={colors} />
          ))}
        </View>
      </View>

    </Screen>
  );
}

const TILE_SIZE = (SW - Spacing.three * 2 - Spacing.two * 2) / 3;

const styles = StyleSheet.create({
  // Greeting
  greetingBlock: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  greetingEyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  greetingTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },

  // Hero banner
  heroBanner: {
    borderRadius: 28,
    padding: Spacing.four,
    gap: Spacing.three,
    overflow: 'hidden',
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
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: {
    color: '#F8E9DE',
    fontFamily: Fonts.rounded,
    fontSize: 12,
  },
  heroYear: {
    color: '#E9D6C8',
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroLogo: {
    width: '100%',
    height: 180,
    alignSelf: 'center',
  },
  heroTagline: {
    color: '#EAD4C7',
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  heroCtas: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  heroCtaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroCtaOutline: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(246,208,184,0.35)',
  },
  heroCtaText: {
    color: '#FFF7F1',
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },

  // News
  newsCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  newsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsHeading: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
  },
  newsFeatured: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  newsFeaturedDate: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  newsFeaturedTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
    lineHeight: 25,
  },
  newsRow: {
    gap: 4,
    paddingBottom: Spacing.two,
  },
  newsRowDate: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  newsRowTitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  newsEmpty: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },

  // Shortcut grid
  gridSection: {
    gap: Spacing.two,
  },
  gridLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  tile: {
    width: TILE_SIZE,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TILE_SIZE * 0.95,
  },
  tileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(24, 36, 55, 0.05)',
    shadowColor: '#1B2230',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  tileTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
});
