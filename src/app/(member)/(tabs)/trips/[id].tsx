import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, GhostButton } from '@/components/ui/primitives';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  getMyTravel,
  getMyTripBalance,
  getTripAlbums,
  getTripAttendees,
  getTripBalances,
  getTripDetail,
  getTripExpenses,
} from '@/features/trips/api';
import { computeSettlement } from '@/features/trips/settle-balances';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type {
  AttendeeStatus,
  ExpenseCategory,
  ExpenseStatus,
  TripAttendee,
  TripBalance,
  TripExpense,
  TripStatus,
} from '@shared/contracts/trips-contract';

// ─── Date helpers ────────────────────────────────────────────────────────────

function parseDay(d: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day));
  }
  return new Date(d);
}

function fmtDate(d: string): string {
  return parseDay(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtDateTime(d: string): string {
  if (d.includes('T')) {
    return new Date(d).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return fmtDate(d);
}

function daysUntil(d: string): number {
  const now = new Date();
  const target = parseDay(d);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const TRIP_STATUS_COLORS: Record<TripStatus, string> = {
  PLANNING:    '#1D4ED8',
  ACTIVE:      '#15803D',
  RECONCILING: '#B45309',
  SETTLED:     '#475569',
  CANCELLED:   '#B91C1C',
};

const ATTENDEE_STATUS_COLORS: Record<AttendeeStatus, string> = {
  CONFIRMED: '#15803D',
  INVITED:   '#1D4ED8',
  DECLINED:  '#475569',
  FORFEITED: '#B91C1C',
};

const EXPENSE_STATUS_COLORS: Record<ExpenseStatus, string> = {
  APPROVED:       '#15803D',
  PENDING_REVIEW: '#B45309',
  FLAGGED:        '#B91C1C',
  REJECTED:       '#475569',
};

const CATEGORY_ICONS: Record<ExpenseCategory, keyof typeof Ionicons.glyphMap> = {
  ACCOMMODATION: 'bed-outline',
  FOOD: 'restaurant-outline',
  TRANSPORT: 'car-outline',
  ACTIVITIES: 'ticket-outline',
  ALCOHOL: 'wine-outline',
  SUPPLIES: 'bag-outline',
  FORFEIT_CREDIT: 'cash-outline',
  OTHER: 'ellipsis-horizontal-outline',
};

function Badge({
  label,
  bg,
}: {
  label: string;
  bg: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: '#fff' }]}>{label}</Text>
    </View>
  );
}

// ─── Tab strip ───────────────────────────────────────────────────────────────

type Tab = 'overview' | 'attendees' | 'expenses' | 'balance' | 'albums';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'attendees', label: 'Attendees' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'balance', label: 'Balance' },
  { key: 'albums', label: 'Albums' },
];

function TabStrip({
  active,
  onSelect,
}: {
  active: Tab;
  onSelect: (t: Tab) => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.tabStrip, { borderBottomColor: colors.border }]}
      contentContainerStyle={styles.tabStripContent}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={[
              styles.tabItem,
              isActive && { borderBottomColor: colors.accent, borderBottomWidth: 3 },
            ]}>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isActive ? colors.accent : colors.text,
                  fontFamily: isActive ? Fonts.rounded : Fonts.sans,
                  opacity: isActive ? 1 : 0.6,
                },
              ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  trip,
  myBalance,
  myTravel,
  tripId,
}: {
  trip: ReturnType<typeof useTripQueries>['detail']['data'];
  myBalance: TripBalance | null | undefined;
  myTravel: { travelMode?: string | null; arrivalTime?: string | null; arrivalAirport?: string | null; departureTime?: string | null; departureAirport?: string | null } | null | undefined;
  tripId: number;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  if (!trip) return null;

  const days = daysUntil(trip.startDate);
  const balance = myBalance?.balance ?? 0;
  const balanceColor = balance > 0.01 ? colors.danger : balance < -0.01 ? colors.success : colors.textSecondary;
  const balanceLabel =
    balance > 0.01
      ? `You owe $${balance.toFixed(2)}`
      : balance < -0.01
        ? `You're owed $${Math.abs(balance).toFixed(2)}`
        : 'Settled ✓';

  return (
    <View style={styles.tabContent}>
      {days > 0 ? (
        <Card style={[styles.highlightCard, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Text style={[styles.countdownLabel, { color: colors.accent }]}>
            {days} day{days !== 1 ? 's' : ''} to go
          </Text>
          <Text style={[styles.countdownSub, { color: colors.textSecondary }]}>
            Trip starts {fmtDate(trip.startDate)}
          </Text>
        </Card>
      ) : null}

      <Card style={styles.balanceCard}>
        <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>My Balance</Text>
        <Text style={[styles.balanceAmount, { color: balanceColor }]}>{balanceLabel}</Text>
        {myBalance?.hasPendingConfirmation ? (
          <Text style={[styles.pendingNote, { color: colors.textMuted }]}>
            Pending admin confirmation
          </Text>
        ) : null}
      </Card>

      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={[styles.statBig, { color: colors.text }]}>
              ${trip.stats.totalSpent.toFixed(0)}
            </Text>
            <Text style={[styles.statSmall, { color: colors.textMuted }]}>Total Spent</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={[styles.statBig, { color: colors.text }]}>{trip.stats.attendeeCount}</Text>
            <Text style={[styles.statSmall, { color: colors.textMuted }]}>Attendees</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={[styles.statBig, { color: colors.text }]}>{trip.stats.expenseCount}</Text>
            <Text style={[styles.statSmall, { color: colors.textMuted }]}>Expenses</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.travelCard}>
        <View style={styles.travelHeader}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>My Travel Details</Text>
          <GhostButton onPress={() => router.push(`/(member)/trips/${tripId}/edit-travel` as never)}>
            Edit
          </GhostButton>
        </View>
        {myTravel?.travelMode ? (
          <View style={styles.travelRow}>
            <Ionicons name="airplane-outline" size={15} color={colors.accent} />
            <Text style={[styles.travelText, { color: colors.textSecondary }]}>{myTravel.travelMode}</Text>
          </View>
        ) : null}
        {myTravel?.arrivalTime ? (
          <View style={styles.travelRow}>
            <Ionicons name="arrow-down-circle-outline" size={15} color={colors.accent} />
            <Text style={[styles.travelText, { color: colors.textSecondary }]}>
              Arrives {fmtDateTime(myTravel.arrivalTime)}
              {myTravel.arrivalAirport ? ` · ${myTravel.arrivalAirport}` : ''}
            </Text>
          </View>
        ) : null}
        {myTravel?.departureTime ? (
          <View style={styles.travelRow}>
            <Ionicons name="arrow-up-circle-outline" size={15} color={colors.accent} />
            <Text style={[styles.travelText, { color: colors.textSecondary }]}>
              Departs {fmtDateTime(myTravel.departureTime)}
              {myTravel.departureAirport ? ` · ${myTravel.departureAirport}` : ''}
            </Text>
          </View>
        ) : null}
        {!myTravel?.travelMode && !myTravel?.arrivalTime && !myTravel?.departureTime ? (
          <Text style={[styles.travelText, { color: colors.textMuted }]}>No travel details added yet.</Text>
        ) : null}
      </Card>
    </View>
  );
}

// ─── Attendees tab ────────────────────────────────────────────────────────────

function AttendeeCard({ attendee }: { attendee: TripAttendee }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const name = attendee.member?.name ?? attendee.legend?.name ?? attendee.guestName ?? 'Guest';
  const bg = ATTENDEE_STATUS_COLORS[attendee.status];

  return (
    <Card style={styles.attendeeCard}>
      <View style={styles.attendeeHeader}>
        <Text style={[styles.attendeeName, { color: colors.text }]}>{name}</Text>
        <Badge label={attendee.status} bg={bg} />
      </View>
      {attendee.travelMode ? (
        <View style={styles.travelRow}>
          <Ionicons name="airplane-outline" size={13} color={colors.accent} />
          <Text style={[styles.travelText, { color: colors.textSecondary }]}>{attendee.travelMode}</Text>
        </View>
      ) : null}
      {attendee.arrivalTime ? (
        <View style={styles.travelRow}>
          <Ionicons name="arrow-down-circle-outline" size={13} color={colors.accent} />
          <Text style={[styles.travelText, { color: colors.textSecondary }]}>
            {fmtDateTime(attendee.arrivalTime)}
            {attendee.arrivalAirport ? ` · ${attendee.arrivalAirport}` : ''}
          </Text>
        </View>
      ) : null}
      {attendee.departureTime ? (
        <View style={styles.travelRow}>
          <Ionicons name="arrow-up-circle-outline" size={13} color={colors.accent} />
          <Text style={[styles.travelText, { color: colors.textSecondary }]}>
            {fmtDateTime(attendee.departureTime)}
            {attendee.departureAirport ? ` · ${attendee.departureAirport}` : ''}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function AttendeesTab({ attendees }: { attendees: TripAttendee[] }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];

  const rideshareGroups = useMemo(() => {
    const map = new Map<string, TripAttendee[]>();
    for (const a of attendees) {
      if (!a.arrivalAirport || a.status === 'DECLINED' || a.status === 'FORFEITED') continue;
      const key = a.arrivalAirport.toUpperCase();
      const group = map.get(key) ?? [];
      group.push(a);
      map.set(key, group);
    }
    return [...map.entries()].filter(([, group]) => group.length >= 2);
  }, [attendees]);

  return (
    <View style={styles.tabContent}>
      {attendees.map((a) => (
        <AttendeeCard key={a.id} attendee={a} />
      ))}
      {rideshareGroups.length > 0 ? (
        <Card style={[styles.rideshareCard, { borderColor: colors.accent }]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Rideshare Opportunities</Text>
          <Text style={[styles.travelText, { color: colors.textMuted }]}>People arriving at the same airport</Text>
          {rideshareGroups.map(([airport, group]) => (
            <View key={airport} style={styles.rideshareItem}>
              <Ionicons name="car-outline" size={15} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.travelText, { color: colors.text, fontFamily: Fonts.rounded }]}>{airport}</Text>
                <Text style={[styles.travelText, { color: colors.textSecondary }]}>
                  {group.map((a) => a.member?.name ?? a.legend?.name ?? a.guestName ?? 'Guest').join(' · ')}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      {attendees.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No attendees yet.</Text>
      ) : null}
    </View>
  );
}

// ─── Expenses tab ─────────────────────────────────────────────────────────────

function ExpenseCard({ expense }: { expense: TripExpense }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const [expanded, setExpanded] = useState(false);
  const expBg = EXPENSE_STATUS_COLORS[expense.status];
  const icon = CATEGORY_ICONS[expense.category] ?? 'ellipsis-horizontal-outline';

  return (
    <Pressable onPress={() => setExpanded((v) => !v)}>
      <Card style={styles.expenseCard}>
        <View style={styles.expenseHeader}>
          <View style={styles.expenseIcon}>
            <Ionicons name={icon} size={18} color={colors.accent} />
          </View>
          <View style={styles.expenseInfo}>
            <Text style={[styles.expenseTitle, { color: colors.text }]}>{expense.title}</Text>
            <Text style={[styles.expenseMeta, { color: colors.textMuted }]}>
              {fmtDate(expense.date)}
              {expense.paidByMember ? ` · Paid by ${expense.paidByMember.name}` : ''}
            </Text>
          </View>
          <View style={styles.expenseRight}>
            <Text style={[styles.expenseAmount, { color: colors.text }]}>
              ${parseFloat(expense.totalAmount).toFixed(2)}
            </Text>
            <Badge label={expense.status.replace('_', ' ')} bg={expBg} />
          </View>
        </View>
        {expanded && expense.splits.length > 0 ? (
          <View style={[styles.splitsBox, { borderTopColor: colors.border }]}>
            {expense.splits.map((split) => (
              <View key={split.id} style={styles.splitRow}>
                <Text style={[styles.splitName, { color: colors.textSecondary }]}>
                  {split.member?.name ?? split.guestName ?? 'Unknown'}
                </Text>
                <Text style={[styles.splitAmount, { color: colors.text }]}>
                  ${parseFloat(split.shareAmount).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

type ExpenseFilter = 'all' | 'approved' | 'pending';

function ExpensesTab({ expenses, tripId, refetch, tintColor }: { expenses: TripExpense[]; tripId: number; refetch: () => void; tintColor: string }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const [filter, setFilter] = useState<ExpenseFilter>('all');

  const visible = useMemo(
    () =>
      expenses
        .filter((e) => e.category !== 'FORFEIT_CREDIT')
        .filter((e) => {
          if (filter === 'approved') return e.status === 'APPROVED';
          if (filter === 'pending') return e.status === 'PENDING_REVIEW';
          return true;
        }),
    [expenses, filter],
  );

  const chips: { key: ExpenseFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'approved', label: 'Approved' },
    { key: 'pending', label: 'Pending' },
  ];

  return (
    <View style={styles.tabFlex}>
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {chips.map((chip) => (
          <Pressable
            key={chip.key}
            onPress={() => setFilter(chip.key)}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === chip.key ? colors.accentSoft : colors.surfaceMuted,
                borderColor: filter === chip.key ? colors.accent : colors.border,
              },
            ]}>
            <Text
              style={[
                styles.filterChipText,
                { color: filter === chip.key ? colors.accent : colors.textSecondary },
              ]}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={tintColor} />}
      >
        <View style={styles.tabContent}>
          {visible.map((e) => (
            <ExpenseCard key={e.id} expense={e} />
          ))}
          {visible.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No expenses.</Text>
          ) : null}
        </View>
      </ScrollView>
      <Pressable
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() => router.push(`/(member)/trips/${tripId}/submit-expense` as never)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

// ─── Balance tab ──────────────────────────────────────────────────────────────

function BalanceTab({
  balances,
  myMemberId,
}: {
  balances: TripBalance[];
  myMemberId: number | null;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const [showSettlement, setShowSettlement] = useState(false);

  const settlement = useMemo(() => computeSettlement(balances), [balances]);

  return (
    <View style={styles.tabContent}>
      {balances.map((b) => {
        const isMe = b.memberId === myMemberId;
        const bColor = b.balance > 0.01 ? colors.danger : b.balance < -0.01 ? colors.success : colors.textSecondary;
        return (
          <Card
            key={b.memberId ?? b.name}
            style={[styles.balanceRow, isMe && { borderColor: colors.accent }]}>
            <View style={styles.balanceRowLeft}>
              <Text style={[styles.balanceName, { color: colors.text }]}>
                {b.name}
                {isMe ? ' (you)' : ''}
              </Text>
              <Text style={[styles.balanceSub, { color: colors.textMuted }]}>
                Paid ${b.totalPaid.toFixed(2)} · Owes ${b.shareOwed.toFixed(2)}
              </Text>
            </View>
            <Text style={[styles.balanceAmount, { color: bColor }]}>
              {b.balance > 0.01
                ? `-$${b.balance.toFixed(2)}`
                : b.balance < -0.01
                  ? `+$${Math.abs(b.balance).toFixed(2)}`
                  : '✓'}
            </Text>
          </Card>
        );
      })}

      {settlement.length > 0 ? (
        <Card style={styles.settlementCard}>
          <Pressable onPress={() => setShowSettlement((v) => !v)} style={styles.settlementHeader}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              Settlement Plan ({settlement.length} transaction{settlement.length !== 1 ? 's' : ''})
            </Text>
            <Ionicons
              name={showSettlement ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </Pressable>
          {showSettlement
            ? settlement.map((tx, i) => (
                <View key={i} style={styles.settleTx}>
                  <Ionicons name="arrow-forward" size={14} color={colors.accent} />
                  <Text style={[styles.settleTxText, { color: colors.textSecondary }]}>
                    {tx.fromName} pays {tx.toName}{' '}
                    <Text style={{ color: colors.text, fontFamily: Fonts.rounded }}>
                      ${tx.amount.toFixed(2)}
                    </Text>
                  </Text>
                </View>
              ))
            : null}
        </Card>
      ) : (
        <Card style={styles.settledCard}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} style={{ alignSelf: 'center' }} />
          <Text style={[styles.settledText, { color: colors.success }]}>Everyone is settled up!</Text>
        </Card>
      )}
    </View>
  );
}

// ─── Albums tab ───────────────────────────────────────────────────────────────

function AlbumsTab({
  albums,
  tripId,
}: {
  albums: Array<{ id: number; title: string; coverPhotoUrl: string | null; isLocked: boolean; _count: { photos: number } }>;
  tripId: number;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];

  return (
    <View style={styles.tabContent}>
      <View style={styles.albumGrid}>
        {albums.map((album) => (
          <Pressable
            key={album.id}
            style={styles.albumCell}
            onPress={() => router.push(`/(member)/trips/${tripId}/album/${album.id}` as never)}>
            {({ pressed }) => (
              <Card style={[styles.albumCard, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
                <View style={[styles.albumThumb, { backgroundColor: colors.surfaceMuted }]}>
                  <Ionicons name="images-outline" size={28} color={colors.textMuted} />
                </View>
                <Text style={[styles.albumTitle, { color: colors.text }]} numberOfLines={2}>
                  {album.title}
                </Text>
                <Text style={[styles.albumCount, { color: colors.textMuted }]}>
                  {album._count.photos} photo{album._count.photos !== 1 ? 's' : ''}
                  {album.isLocked ? ' · Locked' : ''}
                </Text>
              </Card>
            )}
          </Pressable>
        ))}
      </View>
      {albums.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No albums yet.</Text>
      ) : null}
    </View>
  );
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useTripQueries(tripId: number) {
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);

  const detail = useQuery({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTripDetail(token, tripId);
    },
  });

  const attendees = useQuery({
    queryKey: ['trip-attendees', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTripAttendees(token, tripId);
    },
  });

  const expenses = useQuery({
    queryKey: ['trip-expenses', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTripExpenses(token, tripId);
    },
  });

  const balances = useQuery({
    queryKey: ['trip-balances', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTripBalances(token, tripId);
    },
  });

  const myBalance = useQuery({
    queryKey: ['trip-balance-mine', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getMyTripBalance(token, tripId);
    },
  });

  const albums = useQuery({
    queryKey: ['trip-albums', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getTripAlbums(token, tripId);
    },
  });

  const myTravel = useQuery({
    queryKey: ['trip-my-travel', tripId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getMyTravel(token, tripId);
    },
  });

  return { detail, attendees, expenses, balances, myBalance, albums, myTravel };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = parseInt(id ?? '0', 10);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { detail, attendees, expenses, balances, myBalance, albums, myTravel } =
    useTripQueries(tripId);

  const myMemberId = useMemo(() => {
    const mb = myBalance.data;
    return mb?.memberId ?? null;
  }, [myBalance.data]);

  const isLoading = detail.isLoading;

  function refetchAll() {
    void detail.refetch();
    void attendees.refetch();
    void expenses.refetch();
    void balances.refetch();
    void myBalance.refetch();
    void albums.refetch();
    void myTravel.refetch();
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const trip = detail.data;
  const tripStatus = trip?.status ?? 'PLANNING';
  const tripStatusBg = TRIP_STATUS_COLORS[tripStatus];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.headerArea}>
        <BackLink />
        <View style={styles.tripTitleRow}>
          <Text style={[styles.screenTitle, { color: colors.text }]} numberOfLines={2}>
            {trip?.title ?? '—'}
          </Text>
          <Badge label={tripStatus} bg={tripStatusBg} />
        </View>
        {trip ? (
          <View style={styles.metaRow}>
            {trip.location ? (
              <View style={styles.inlineRow}>
                <Ionicons name="location-outline" size={13} color={colors.accent} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{trip.location}</Text>
              </View>
            ) : null}
            <View style={styles.inlineRow}>
              <Ionicons name="calendar-outline" size={13} color={colors.accent} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <TabStrip active={activeTab} onSelect={setActiveTab} />

      <View style={styles.flex}>
        {activeTab === 'overview' ? (
          <ScrollView
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            refreshControl={<RefreshControl refreshing={detail.isRefetching} onRefresh={refetchAll} tintColor={colors.accent} />}
          >
            <OverviewTab trip={trip} myBalance={myBalance.data} myTravel={myTravel.data} tripId={tripId} />
          </ScrollView>
        ) : activeTab === 'attendees' ? (
          <ScrollView
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            refreshControl={<RefreshControl refreshing={attendees.isRefetching} onRefresh={refetchAll} tintColor={colors.accent} />}
          >
            <AttendeesTab attendees={attendees.data ?? []} />
          </ScrollView>
        ) : activeTab === 'expenses' ? (
          <ExpensesTab expenses={expenses.data ?? []} tripId={tripId} refetch={refetchAll} tintColor={colors.accent} />
        ) : activeTab === 'balance' ? (
          <ScrollView
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            refreshControl={<RefreshControl refreshing={balances.isRefetching} onRefresh={refetchAll} tintColor={colors.accent} />}
          >
            <BalanceTab balances={balances.data ?? []} myMemberId={myMemberId} />
          </ScrollView>
        ) : (
          <ScrollView
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            refreshControl={<RefreshControl refreshing={albums.isRefetching} onRefresh={refetchAll} tintColor={colors.accent} />}
          >
            <AlbumsTab albums={albums.data ?? []} tripId={tripId} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerArea: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.one,
    gap: Spacing.one,
  },
  tripTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  screenTitle: {
    flex: 1,
    fontFamily: Fonts.rounded,
    fontSize: 26,
    lineHeight: 32,
  },
  metaRow: {
    gap: 4,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  tabStrip: {
    borderBottomWidth: 1,
    marginTop: Spacing.one,
  },
  tabStripContent: {
    paddingHorizontal: Spacing.two,
    gap: 0,
  },
  tabItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    marginBottom: -1,
  },
  tabLabel: {
    fontSize: 15,
  },
  flex: {
    flex: 1,
  },
  tabContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: 124,
    gap: Spacing.three,
  },
  tabFlex: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  // Overview
  highlightCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  countdownLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 28,
  },
  countdownSub: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  balanceCard: {
    gap: Spacing.one,
  },
  balanceLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceAmount: {
    fontFamily: Fonts.rounded,
    fontSize: 28,
  },
  pendingNote: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  statsCard: {},
  statsRow: {
    flexDirection: 'row',
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statBig: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
  },
  statSmall: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  travelCard: {
    gap: Spacing.two,
  },
  travelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  travelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  travelText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeading: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  // Attendees
  attendeeCard: {
    gap: Spacing.one,
  },
  attendeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  attendeeName: {
    flex: 1,
    fontFamily: Fonts.rounded,
    fontSize: 17,
  },
  rideshareCard: {
    borderWidth: 1,
    gap: Spacing.two,
  },
  rideshareItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  // Expenses
  expenseCard: {
    gap: Spacing.two,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  expenseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: {
    flex: 1,
    gap: 2,
  },
  expenseTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  expenseMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  expenseAmount: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  splitsBox: {
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  splitName: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  splitAmount: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  // Balance
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  balanceRowLeft: {
    flex: 1,
    gap: 2,
  },
  balanceName: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  balanceSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  settlementCard: {
    gap: Spacing.two,
  },
  settlementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settleTx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  settleTxText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  settledCard: {
    gap: Spacing.two,
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  settledText: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  // Albums
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  albumCell: {
    width: '47%',
  },
  albumCard: {
    gap: Spacing.one,
    padding: Spacing.two,
  },
  albumThumb: {
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  albumTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  albumCount: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  // Shared
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: Fonts.rounded,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
