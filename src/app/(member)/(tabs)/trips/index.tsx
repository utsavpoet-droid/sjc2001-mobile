import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getTrips } from '@/features/trips/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TripStatus } from '@shared/contracts/trips-contract';

type TripListItem = {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  location: string | null;
  status: TripStatus;
  _count: { attendees: number; expenses: number };
};

function parseDay(d: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day));
  }
  return new Date(d);
}

function fmtTripDate(d: string): string {
  return parseDay(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const STATUS_COLORS: Record<TripStatus, { bg: string; text: string }> = {
  PLANNING: { bg: '#1D4ED8', text: '#BFDBFE' },
  ACTIVE: { bg: '#15803D', text: '#BBF7D0' },
  RECONCILING: { bg: '#B45309', text: '#FDE68A' },
  SETTLED: { bg: '#475569', text: '#CBD5E1' },
  CANCELLED: { bg: '#B91C1C', text: '#FECACA' },
};

function StatusBadge({ status }: { status: TripStatus }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.PLANNING;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg + '33', borderColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{status}</Text>
    </View>
  );
}

function TripCard({ trip }: { trip: TripListItem }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  return (
    <Pressable onPress={() => router.push(`/(member)/trips/${trip.id}` as never)}>
      {({ pressed }) => (
        <Card style={[styles.tripCard, { transform: [{ scale: pressed ? 0.988 : 1 }] }]}>
          <View style={styles.tripHeader}>
            <View style={styles.tripTitleRow}>
              <Text style={[styles.tripTitle, { color: colors.text }]} numberOfLines={1}>
                {trip.title}
              </Text>
              <StatusBadge status={trip.status} />
            </View>
            <View style={styles.tripMeta}>
              {trip.location ? (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={13} color={colors.accent} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>{trip.location}</Text>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={13} color={colors.accent} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {fmtTripDate(trip.startDate)} – {fmtTripDate(trip.endDate)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{trip._count.attendees}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Attendees</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{trip._count.expenses}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Expenses</Text>
            </View>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

export default function TripsScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);

  const query = useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTrips(token);
    },
  });

  return (
    <Screen>
      <FlatList
        data={(query.data ?? []) as TripListItem[]}
        keyExtractor={(item) => String(item.id)}
        initialNumToRender={12}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionTitle
              eyebrow="Travel"
              title="Trips"
              subtitle="Your upcoming and past group trips."
            />
            {query.isLoading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} /> : null}
          </View>
        }
        ListEmptyComponent={
          !query.isLoading ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="airplane-outline" size={36} color={colors.textMuted} style={{ alignSelf: 'center' }} />
              {query.isError ? (
                <Text style={[styles.emptyText, { color: colors.danger }]}>
                  {query.error instanceof Error ? query.error.message : 'Failed to load trips'}
                </Text>
              ) : (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No trips yet.</Text>
              )}
            </Card>
          ) : null
        }
        renderItem={({ item }) => <TripCard trip={item} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: Spacing.four,
    paddingBottom: 124,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.three,
  },
  tripCard: {
    gap: Spacing.two,
    borderRadius: 28,
  },
  tripHeader: {
    gap: Spacing.one,
  },
  tripTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tripTitle: {
    flex: 1,
    fontFamily: Fonts.rounded,
    fontSize: 20,
  },
  tripMeta: {
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  statLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  emptyCard: {
    gap: Spacing.two,
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    textAlign: 'center',
  },
});
