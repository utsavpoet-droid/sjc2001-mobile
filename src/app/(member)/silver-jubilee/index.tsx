import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getSilverJubileeSchedule, type SilverJubileeScheduleItem } from '@/features/content/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

type DayGroup = {
  dateKey: string;
  label: string;
  events: SilverJubileeScheduleItem[];
};

/**
 * Bucket the (already backend-sorted) schedule into days for the timeline
 * headers. Presentation only — chronological ordering is the backend's job so
 * web and app can't disagree.
 */
function groupByDay(items: SilverJubileeScheduleItem[]): DayGroup[] {
  const groups: DayGroup[] = [];
  let dayNumber = 0;

  for (const item of items) {
    // Schedule dates are stored date-only (UTC midnight); read them back in UTC
    // so a day never slips for readers in another timezone.
    const parsed = item.date ? new Date(item.date) : null;
    const valid = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    const dateKey = valid ? valid.toISOString().slice(0, 10) : '__none__';

    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      let label = 'Schedule';
      if (valid) {
        dayNumber += 1;
        label = `Day ${dayNumber} — ${valid.toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })}`;
      }
      group = { dateKey, label, events: [] };
      groups.push(group);
    }
    group.events.push(item);
  }

  return groups;
}

export default function SilverJubileeScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const query = useQuery({
    queryKey: ['silver-jubilee'],
    queryFn: () => getSilverJubileeSchedule(),
  });

  const groups = useMemo(
    () => groupByDay(Array.isArray(query.data) ? query.data : []),
    [query.data],
  );

  return (
    <Screen scroll>
      <BackLink label="Back to account" />
      <SectionTitle
        eyebrow="Silver Jubilee"
        title="The reunion schedule"
        subtitle="A mobile-friendly view of the Silver Jubilee plan, timings, and key moments."
      />

      {query.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

      <View style={styles.stack}>
        {groups.map((group) => (
          <View key={group.dateKey} style={styles.group}>
            <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>{group.label}</Text>

            {group.events.map((item) => (
              <Card key={item.id} style={styles.card}>
                <Text style={[styles.time, { color: colors.accent }]}>{item.time}</Text>
                <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                {item.location ? (
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.location}</Text>
                ) : null}
                {item.description ? (
                  <Text style={[styles.body, { color: colors.textSecondary }]}>{item.description}</Text>
                ) : null}

                {item.dressCode ? (
                  <View style={[styles.dressCode, { backgroundColor: colors.accentSoft }]}>
                    <Ionicons name="shirt-outline" size={14} color={colors.accent} />
                    <Text style={[styles.dressCodeLabel, { color: colors.accent }]}>Dress code</Text>
                    <Text style={[styles.dressCodeValue, { color: colors.text }]} numberOfLines={2}>
                      {item.dressCode}
                    </Text>
                  </View>
                ) : null}

                {item.hasDetails ? (
                  <Pressable
                    onPress={() => router.push(`/(member)/silver-jubilee/${item.id}` as Href)}
                    style={({ pressed }) => [styles.detailsLink, { opacity: pressed ? 0.6 : 1 }]}>
                    <Text style={[styles.detailsText, { color: colors.accent }]}>
                      View details
                      {item.photos.length > 0
                        ? ` · ${item.photos.length} photo${item.photos.length === 1 ? '' : 's'}`
                        : ''}
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.accent} />
                  </Pressable>
                ) : null}
              </Card>
            ))}
          </View>
        ))}

        {!query.isLoading && groups.length === 0 ? (
          <Card>
            <Text style={[styles.body, { color: colors.textSecondary }]}>The Silver Jubilee schedule has not been published yet.</Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.three,
  },
  dayLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  card: {
    gap: Spacing.one,
  },
  time: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
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
  dressCode: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dressCodeLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dressCodeValue: {
    flexShrink: 1,
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  detailsLink: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  detailsText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
});
