import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getSilverJubileeSchedule } from '@/features/content/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

type JubileeItem = {
  id: number;
  date?: string | null;
  time: string;
  title: string;
  description?: string | null;
  location?: string | null;
};

export default function SilverJubileeScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const query = useQuery({
    queryKey: ['silver-jubilee'],
    queryFn: () => getSilverJubileeSchedule(),
  });

  const items = Array.isArray(query.data) ? (query.data as JubileeItem[]) : [];

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
        {items.map((item) => (
          <Card key={item.id} style={styles.card}>
            <Text style={[styles.time, { color: colors.accent }]}>{item.time}</Text>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            {item.date ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{new Date(item.date).toLocaleDateString()}</Text> : null}
            {item.location ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.location}</Text> : null}
            {item.description ? <Text style={[styles.body, { color: colors.textSecondary }]}>{item.description}</Text> : null}
          </Card>
        ))}
        {!query.isLoading && items.length === 0 ? (
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
    gap: Spacing.three,
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
});
