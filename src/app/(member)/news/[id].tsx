import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, GhostButton } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getNews } from '@/features/content/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

function formatNewsDate(value: unknown) {
  if (typeof value !== 'string' || !value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function normalizeBody(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  const unwrapped = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
  return unwrapped.replace(/\r\n/g, '\n').replace(/\n/g, '\n').trim();
}

type NewsItem = {
  id?: number;
  title?: string | null;
  body?: string | null;
  publishedAt?: string | null;
};

export default function NewsDetailScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useLocalSearchParams<{ id: string }>();

  const newsQuery = useQuery({
    queryKey: ['news', 'detail'],
    queryFn: () => getNews(),
  });

  const ordered = useMemo(() => {
    const items = (Array.isArray(newsQuery.data) ? newsQuery.data : []) as NewsItem[];
    return [...items].sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [newsQuery.data]);

  const currentIndex = useMemo(
    () => ordered.findIndex((item) => String(item.id) === String(id)),
    [id, ordered],
  );
  const current = currentIndex >= 0 ? ordered[currentIndex] : undefined;
  const newer = currentIndex > 0 ? ordered[currentIndex - 1] : undefined;
  const older = currentIndex >= 0 && currentIndex < ordered.length - 1 ? ordered[currentIndex + 1] : undefined;

  return (
    <Screen scroll>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(member)/(tabs)/home' as Href))}
        style={({ pressed }) => [
          styles.backButton,
          {
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderColor: colors.border,
          },
        ]}>
        <Ionicons name="arrow-back" size={18} color={colors.text} />
        <Text style={[styles.backLabel, { color: colors.text }]}>Back to home</Text>
      </Pressable>

      {current ? (
        <>
          <View style={styles.headerBlock}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>News</Text>
            <Text style={[styles.title, { color: colors.text }]}>
              {current.title || 'Update from the circle'}
            </Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>
              {formatNewsDate(current.publishedAt)}
            </Text>
          </View>

          <Card style={[styles.bodyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.bodyText, { color: colors.text }]}>
              {normalizeBody(current.body) || 'No details were published for this update.'}
            </Text>
          </Card>

          <View style={styles.navRow}>
            <GhostButton onPress={() => newer && router.replace(`/(member)/news/${newer.id}` as Href)} disabled={!newer}>
              Newer
            </GhostButton>
            <GhostButton onPress={() => older && router.replace(`/(member)/news/${older.id}` as Href)} disabled={!older}>
              Next News
            </GhostButton>
          </View>

          <View style={[styles.listCard, { backgroundColor: colors.backgroundSoft, borderColor: colors.border }]}> 
            <Text style={[styles.listHeading, { color: colors.text }]}>Newest to oldest</Text>
            {ordered.map((item) => {
              const active = item.id === current.id;
              return (
                <Pressable
                  key={String(item.id)}
                  onPress={() => item.id && router.replace(`/(member)/news/${item.id}` as Href)}
                  style={({ pressed }) => [
                    styles.listRow,
                    {
                      opacity: pressed ? 0.84 : 1,
                      backgroundColor: active ? colors.surface : 'transparent',
                      borderColor: active ? colors.border : 'transparent',
                    },
                  ]}>
                  <View style={styles.listCopy}>
                    <Text style={[styles.listDate, { color: colors.accent }]}>
                      {formatNewsDate(item.publishedAt)}
                    </Text>
                    <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={2}>
                      {item.title || 'Update from the circle'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <Card style={[styles.bodyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
            This news item could not be found.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  headerBlock: {
    gap: Spacing.one,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 30,
    lineHeight: 36,
  },
  date: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  bodyCard: {
    borderRadius: 28,
    padding: Spacing.four,
  },
  bodyText: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 26,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  listHeading: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  listRow: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  listCopy: {
    flex: 1,
    gap: 4,
  },
  listDate: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  listTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    lineHeight: 22,
  },
});
