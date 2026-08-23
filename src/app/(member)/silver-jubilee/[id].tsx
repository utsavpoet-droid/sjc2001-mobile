import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/primitives';
import { RichText } from '@/components/ui/rich-text';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getSilverJubileeScheduleItem } from '@/features/content/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

function formatEventDate(value: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function SilverJubileeEventScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Number.parseInt(String(id), 10);

  const query = useQuery({
    queryKey: ['silver-jubilee', 'detail', eventId],
    queryFn: () => getSilverJubileeScheduleItem(eventId),
    enabled: Number.isFinite(eventId) && eventId > 0,
  });

  const event = query.data;
  const photos = event?.photos ?? [];
  const dateLabel = formatEventDate(event?.date ?? null);

  function openPhoto(startIndex: number) {
    const uris = photos.map((p) => p.photoUrl);
    router.push(
      `/(member)/photo-preview?uris=${encodeURIComponent(JSON.stringify(uris))}&startIndex=${startIndex}` as never,
    );
  }

  return (
    <Screen scroll>
      <BackLink label="Back to schedule" />

      {query.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      {query.isError ? (
        <Card>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            We couldn&apos;t load this event. Pull back and try again.
          </Text>
        </Card>
      ) : null}

      {event ? (
        <>
          <View style={styles.header}>
            <Text style={[styles.time, { color: colors.accent }]}>
              {event.time}
              {dateLabel ? ` · ${dateLabel}` : ''}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>
            {event.location ? (
              <Text style={[styles.meta, { color: colors.textSecondary }]}>{event.location}</Text>
            ) : null}
            {event.description ? (
              <Text style={[styles.body, { color: colors.textSecondary }]}>{event.description}</Text>
            ) : null}
          </View>

          {event.dressCode ? (
            <Card style={[styles.section, { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }]}>
              <View style={styles.sectionHeading}>
                <Ionicons name="shirt-outline" size={16} color={colors.accent} />
                <Text style={[styles.sectionLabel, { color: colors.accent }]}>Dress code</Text>
              </View>
              <Text style={[styles.dressCodeValue, { color: colors.text }]}>{event.dressCode}</Text>
            </Card>
          ) : null}

          {photos.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Ionicons name="images-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Photos</Text>
              </View>
              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <Pressable
                    key={photo.id}
                    onPress={() => openPhoto(index)}
                    style={({ pressed }) => [styles.photoTile, { opacity: pressed ? 0.75 : 1 }]}>
                    <Image
                      source={{ uri: photo.photoUrl }}
                      style={[styles.photo, { backgroundColor: colors.surfaceMuted }]}
                      contentFit="cover"
                    />
                    {photo.caption ? (
                      <Text style={[styles.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                        {photo.caption}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {event.instructions ? (
            <Card style={styles.section}>
              <View style={styles.sectionHeading}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Instructions</Text>
              </View>
              <RichText text={event.instructions} color={colors.text} linkColor={colors.accent} />
            </Card>
          ) : null}

          {!event.dressCode && !event.instructions && photos.length === 0 ? (
            <Card>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                No extra details have been added for this event yet.
              </Text>
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  time: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  meta: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  dressCodeValue: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoTile: {
    width: '48%',
    gap: Spacing.one,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
  },
  caption: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
});
