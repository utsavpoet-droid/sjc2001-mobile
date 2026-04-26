import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/primitives';
import { BottomTabInset, Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
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

function fmtDateShort(d: string): string {
  return parseDay(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtDateTime(d: string): string {
  if (d.includes('T')) {
    // Strip timezone suffix so the stored wall-clock time is displayed
    // exactly as entered by admin — no local-timezone conversion.
    const naive = d.replace(/Z$/, '').replace(/\.\d+$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
    const [datePart, timePart] = naive.split('T');
    const [y, mo, day] = datePart.split('-').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    return new Date(y, mo - 1, day, h, min).toLocaleString('en-US', {
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

function tripDayInfo(start: string, end: string): { phase: 'before' | 'during' | 'after'; label: string; sub: string } {
  const now = new Date();
  const startDate = parseDay(start);
  const endDate = parseDay(end);
  const dayMs = 86400000;
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / dayMs) + 1);

  if (now < startDate) {
    const days = Math.ceil((startDate.getTime() - now.getTime()) / dayMs);
    return {
      phase: 'before',
      label: `${days}`,
      sub: `day${days !== 1 ? 's' : ''} to go`,
    };
  }
  if (now > new Date(endDate.getTime() + dayMs)) {
    const days = Math.floor((now.getTime() - endDate.getTime()) / dayMs);
    return {
      phase: 'after',
      label: `${days}`,
      sub: `day${days !== 1 ? 's' : ''} ago`,
    };
  }
  const dayN = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / dayMs) + 1);
  return {
    phase: 'during',
    label: `Day ${dayN}`,
    sub: `of ${totalDays}`,
  };
}

// ─── Status colors ───────────────────────────────────────────────────────────

const TRIP_STATUS_COLORS: Record<TripStatus, string> = {
  PLANNING:    '#1D4ED8',
  ACTIVE:      '#15803D',
  RECONCILING: '#B45309',
  SETTLED:     '#475569',
  CANCELLED:   '#B91C1C',
};

const TRIP_STATUS_GRADIENTS: Record<TripStatus, [string, string]> = {
  PLANNING:    ['#3B82F6', '#1E3A8A'],
  ACTIVE:      ['#22C55E', '#14532D'],
  RECONCILING: ['#F59E0B', '#78350F'],
  SETTLED:     ['#94A3B8', '#334155'],
  CANCELLED:   ['#EF4444', '#7F1D1D'],
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

const PHASES: { key: TripStatus; label: string }[] = [
  { key: 'PLANNING', label: 'Planning' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'RECONCILING', label: 'Settling' },
  { key: 'SETTLED', label: 'Settled' },
];

function Badge({ label, bg }: { label: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: '#fff' }]}>{label}</Text>
    </View>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function TripHero({
  trip,
  myBalance,
}: {
  trip: { title: string; status: TripStatus; startDate: string; endDate: string; location: string | null; stats: { totalSpent: number; attendeeCount: number; expenseCount: number } };
  myBalance: TripBalance | null | undefined;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const dayInfo = tripDayInfo(trip.startDate, trip.endDate);
  const gradient = TRIP_STATUS_GRADIENTS[trip.status];
  const balance = myBalance?.balance ?? 0;
  const myMoneyLabel =
    Math.abs(balance) < 0.01
      ? 'Settled'
      : balance > 0
        ? `Owe $${balance.toFixed(2)}`
        : `+$${Math.abs(balance).toFixed(2)}`;
  const myMoneyColor =
    Math.abs(balance) < 0.01 ? '#FFFFFF' : balance > 0 ? '#FECACA' : '#BBF7D0';

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroPill}>
          <View style={[styles.heroDot, { backgroundColor: '#fff' }]} />
          <Text style={styles.heroPillText}>{trip.status}</Text>
        </View>
        {trip.location ? (
          <View style={styles.heroPill}>
            <Ionicons name="location" size={12} color="#fff" />
            <Text style={styles.heroPillText} numberOfLines={1}>{trip.location}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.heroTitle} numberOfLines={2}>{trip.title}</Text>

      <View style={styles.heroCountdown}>
        <Text style={styles.heroCountdownNumber}>{dayInfo.label}</Text>
        <View style={styles.heroCountdownRight}>
          <Text style={styles.heroCountdownSub}>{dayInfo.sub}</Text>
          <Text style={styles.heroCountdownDates}>
            {fmtDateShort(trip.startDate)} – {fmtDateShort(trip.endDate)}
          </Text>
        </View>
      </View>

      <View style={styles.heroStatsRow}>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatBig}>${trip.stats.totalSpent.toFixed(0)}</Text>
          <Text style={styles.heroStatSmall}>Total</Text>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroStat}>
          <Text style={styles.heroStatBig}>{trip.stats.attendeeCount}</Text>
          <Text style={styles.heroStatSmall}>Going</Text>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroStat}>
          <Text style={[styles.heroStatBig, { color: myMoneyColor }]}>{myMoneyLabel}</Text>
          <Text style={styles.heroStatSmall}>You</Text>
        </View>
      </View>

      {/* Phase strip */}
      <View style={styles.phaseStrip}>
        {PHASES.map((p, i) => {
          const currentIdx = PHASES.findIndex((x) => x.key === trip.status);
          const isDone = i <= currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <View key={p.key} style={styles.phaseItem}>
              <View
                style={[
                  styles.phaseDot,
                  {
                    backgroundColor: isDone ? '#fff' : 'rgba(255,255,255,0.3)',
                    transform: [{ scale: isCurrent ? 1.3 : 1 }],
                  },
                ]}
              />
              <Text
                style={[
                  styles.phaseLabel,
                  { color: isCurrent ? '#fff' : 'rgba(255,255,255,0.6)', fontFamily: isCurrent ? Fonts.rounded : Fonts.sans },
                ]}>
                {p.label}
              </Text>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
}

// ─── Quick actions ───────────────────────────────────────────────────────────

function QuickActions({ tripId }: { tripId: number }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];

  const actions: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    {
      key: 'add-expense',
      icon: 'add-circle',
      label: 'Add\nExpense',
      onPress: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/(member)/trips/${tripId}/submit-expense` as never);
      },
    },
    {
      key: 'edit-travel',
      icon: 'airplane',
      label: 'My\nTravel',
      onPress: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/(member)/trips/${tripId}/edit-travel` as never);
      },
    },
    {
      key: 'pay',
      icon: 'cash-outline',
      label: 'Report\nPayment',
      onPress: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/(member)/trips/${tripId}/report-payment` as never);
      },
    },
  ];

  return (
    <View style={styles.actionsRow}>
      {actions.map((a) => (
        <Pressable
          key={a.key}
          onPress={a.onPress}
          style={({ pressed }) => [
            styles.actionPill,
            {
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderColor: colors.border,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}>
          <View style={[styles.actionIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name={a.icon} size={18} color={colors.accent} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Tab strip ───────────────────────────────────────────────────────────────

type Tab = 'overview' | 'attendees' | 'expenses' | 'balance' | 'albums';
const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'overview', label: 'Overview', icon: 'compass-outline' },
  { key: 'attendees', label: 'People', icon: 'people-outline' },
  { key: 'expenses', label: 'Expenses', icon: 'receipt-outline' },
  { key: 'balance', label: 'Balance', icon: 'scale-outline' },
  { key: 'albums', label: 'Albums', icon: 'images-outline' },
];

function TabStrip({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  return (
    <View style={[styles.tabStripWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabStripContent}>
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                void Haptics.selectionAsync();
                onSelect(tab.key);
              }}
              style={[
                styles.tabItem,
                {
                  backgroundColor: isActive ? colors.accentSoft : 'transparent',
                },
              ]}>
              <Ionicons
                name={tab.icon}
                size={15}
                color={isActive ? colors.accent : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.accent : colors.textSecondary,
                    fontFamily: isActive ? Fonts.rounded : Fonts.sans,
                  },
                ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Overview content ─────────────────────────────────────────────────────────

function OverviewContent({
  trip,
  myBalance,
  myTravel,
  expenses,
  attendees,
  tripId,
}: {
  trip: { startDate: string; endDate: string; status: TripStatus };
  myBalance: TripBalance | null | undefined;
  myTravel: { travelMode?: string | null; arrivalTime?: string | null; arrivalAirport?: string | null; departureTime?: string | null; departureAirport?: string | null } | null | undefined;
  expenses: TripExpense[];
  attendees: TripAttendee[];
  tripId: number;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];

  const recentExpenses = useMemo(
    () => [...expenses].filter((e) => e.category !== 'FORFEIT_CREDIT').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [expenses],
  );

  const confirmedCount = attendees.filter((a) => a.status === 'CONFIRMED').length;
  const invitedCount = attendees.filter((a) => a.status === 'INVITED').length;

  return (
    <View style={styles.tabContent}>
      <Card style={styles.travelCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="airplane-outline" size={18} color={colors.accent} />
            <Text style={[styles.cardHeading, { color: colors.text }]}>My Travel</Text>
          </View>
          <Pressable
            onPress={() => router.push(`/(member)/trips/${tripId}/edit-travel` as never)}
            style={({ pressed }) => [
              styles.editLink,
              { backgroundColor: pressed ? colors.accentSoft : 'transparent' },
            ]}>
            <Text style={[styles.editLinkText, { color: colors.accent }]}>Edit</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </Pressable>
        </View>
        {myTravel?.travelMode || myTravel?.arrivalTime || myTravel?.departureTime ? (
          <View style={styles.travelDetails}>
            {myTravel?.travelMode ? (
              <View style={styles.travelDetailRow}>
                <Text style={[styles.travelKey, { color: colors.textMuted }]}>Mode</Text>
                <Text style={[styles.travelVal, { color: colors.text }]}>{myTravel.travelMode}</Text>
              </View>
            ) : null}
            {myTravel?.arrivalTime ? (
              <View style={styles.travelDetailRow}>
                <Text style={[styles.travelKey, { color: colors.textMuted }]}>Arrive</Text>
                <Text style={[styles.travelVal, { color: colors.text }]}>
                  {fmtDateTime(myTravel.arrivalTime)}
                  {myTravel.arrivalAirport ? ` · ${myTravel.arrivalAirport}` : ''}
                </Text>
              </View>
            ) : null}
            {myTravel?.departureTime ? (
              <View style={styles.travelDetailRow}>
                <Text style={[styles.travelKey, { color: colors.textMuted }]}>Depart</Text>
                <Text style={[styles.travelVal, { color: colors.text }]}>
                  {fmtDateTime(myTravel.departureTime)}
                  {myTravel.departureAirport ? ` · ${myTravel.departureAirport}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={() => router.push(`/(member)/trips/${tripId}/edit-travel` as never)}
            style={({ pressed }) => [
              styles.emptyTravel,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Ionicons name="add" size={18} color={colors.accent} />
            <Text style={[styles.travelVal, { color: colors.accent }]}>Add my travel details</Text>
          </Pressable>
        )}
      </Card>

      <Card style={styles.summaryCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="people-outline" size={18} color={colors.accent} />
            <Text style={[styles.cardHeading, { color: colors.text }]}>Who&apos;s Going</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: '#15803D20', borderColor: '#15803D' }]}>
            <Text style={[styles.summaryChipNum, { color: '#15803D' }]}>{confirmedCount}</Text>
            <Text style={[styles.summaryChipLabel, { color: colors.textSecondary }]}>Confirmed</Text>
          </View>
          {invitedCount > 0 ? (
            <View style={[styles.summaryChip, { backgroundColor: '#1D4ED820', borderColor: '#1D4ED8' }]}>
              <Text style={[styles.summaryChipNum, { color: '#1D4ED8' }]}>{invitedCount}</Text>
              <Text style={[styles.summaryChipLabel, { color: colors.textSecondary }]}>Invited</Text>
            </View>
          ) : null}
        </View>
      </Card>

      {recentExpenses.length > 0 ? (
        <Card style={styles.recentCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="time-outline" size={18} color={colors.accent} />
              <Text style={[styles.cardHeading, { color: colors.text }]}>Recent Expenses</Text>
            </View>
          </View>
          <View style={styles.recentList}>
            {recentExpenses.map((exp) => {
              const icon = CATEGORY_ICONS[exp.category] ?? 'ellipsis-horizontal-outline';
              return (
                <View key={exp.id} style={styles.recentItem}>
                  <View style={[styles.recentIcon, { backgroundColor: colors.accentSoft }]}>
                    <Ionicons name={icon} size={14} color={colors.accent} />
                  </View>
                  <View style={styles.recentInfo}>
                    <Text style={[styles.recentTitle, { color: colors.text }]} numberOfLines={1}>{exp.title}</Text>
                    <Text style={[styles.recentMeta, { color: colors.textMuted }]}>
                      {fmtDate(exp.date)}
                      {exp.paidByMember ? ` · ${exp.paidByMember.name}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.recentAmount, { color: colors.text }]}>${parseFloat(exp.totalAmount).toFixed(0)}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

// ─── Attendees content ───────────────────────────────────────────────────────

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

function AttendeesContent({ attendees }: { attendees: TripAttendee[] }) {
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
          <Text style={[styles.cardHeading, { color: colors.text }]}>Rideshare Opportunities</Text>
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

// ─── Expenses content ────────────────────────────────────────────────────────

function ExpenseCard({ expense }: { expense: TripExpense }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const [expanded, setExpanded] = useState(false);
  const expBg = EXPENSE_STATUS_COLORS[expense.status];
  const icon = CATEGORY_ICONS[expense.category] ?? 'ellipsis-horizontal-outline';

  return (
    <Pressable onPress={() => setExpanded((v) => !v)}>
      <Card style={styles.expenseCard}>
        <View style={styles.expenseHeader}>
          <View style={[styles.expenseIcon, { backgroundColor: colors.accentSoft }]}>
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

function ExpensesContent({ expenses }: { expenses: TripExpense[] }) {
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
    <View style={styles.tabContent}>
      <View style={styles.filterRow}>
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
      {visible.map((e) => (
        <ExpenseCard key={e.id} expense={e} />
      ))}
      {visible.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No expenses.</Text>
      ) : null}
    </View>
  );
}

// ─── Balance content ─────────────────────────────────────────────────────────

function BalanceContent({
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
            <Text style={[styles.cardHeading, { color: colors.text }]}>
              Settlement Plan ({settlement.length})
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
      ) : balances.length > 0 ? (
        <Card style={styles.settledCard}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} style={{ alignSelf: 'center' }} />
          <Text style={[styles.settledText, { color: colors.success }]}>Everyone is settled up!</Text>
        </Card>
      ) : null}
    </View>
  );
}

// ─── Albums content ──────────────────────────────────────────────────────────

function AlbumsContent({
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
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = parseInt(id ?? '0', 10);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const scrollRef = useRef<ScrollView>(null);
  const tabStripOffsetY = useRef(0);

  const { detail, attendees, expenses, balances, myBalance, albums, myTravel } =
    useTripQueries(tripId);

  const myMemberId = useMemo(() => myBalance.data?.memberId ?? null, [myBalance.data]);
  const isLoading = detail.isLoading;
  const trip = detail.data;

  function refetchAll() {
    void detail.refetch();
    void attendees.refetch();
    void expenses.refetch();
    void balances.refetch();
    void myBalance.refetch();
    void albums.refetch();
    void myTravel.refetch();
  }

  function handleSelectTab(t: Tab) {
    setActiveTab(t);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: tabStripOffsetY.current, animated: true });
    });
  }

  if (isLoading || !trip) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.two,
          paddingBottom: BottomTabInset + 56,
        }}
        refreshControl={
          <RefreshControl
            refreshing={detail.isRefetching}
            onRefresh={refetchAll}
            tintColor={colors.accent}
            progressViewOffset={insets.top}
          />
        }>
        <View style={styles.headerSection}>
          <BackLink />
          <TripHero trip={trip} myBalance={myBalance.data} />
          <QuickActions tripId={tripId} />
        </View>

        <View
          onLayout={(e) => {
            tabStripOffsetY.current = e.nativeEvent.layout.y;
          }}>
          <TabStrip active={activeTab} onSelect={handleSelectTab} />
        </View>

        <View>
          {activeTab === 'overview' ? (
            <OverviewContent
              trip={trip}
              myBalance={myBalance.data}
              myTravel={myTravel.data}
              expenses={expenses.data ?? []}
              attendees={attendees.data ?? []}
              tripId={tripId}
            />
          ) : activeTab === 'attendees' ? (
            <AttendeesContent attendees={attendees.data ?? []} />
          ) : activeTab === 'expenses' ? (
            <ExpensesContent expenses={expenses.data ?? []} />
          ) : activeTab === 'balance' ? (
            <BalanceContent balances={balances.data ?? []} myMemberId={myMemberId} />
          ) : (
            <AlbumsContent albums={albums.data ?? []} tripId={tripId} />
          )}
        </View>
      </ScrollView>

      {activeTab === 'expenses' ? (
        <Pressable
          style={[styles.fab, { backgroundColor: colors.accent, bottom: BottomTabInset + 36 }]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push(`/(member)/trips/${tripId}/submit-expense` as never);
          }}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSection: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  // Hero
  hero: {
    borderRadius: 28,
    padding: Spacing.four,
    gap: Spacing.three,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    maxWidth: '80%',
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroPillText: {
    color: '#fff',
    fontFamily: Fonts.rounded,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: '#fff',
    fontFamily: Fonts.rounded,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  heroCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroCountdownNumber: {
    color: '#fff',
    fontFamily: Fonts.rounded,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2,
  },
  heroCountdownRight: {
    flex: 1,
    gap: 2,
  },
  heroCountdownSub: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  heroCountdownDates: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingVertical: Spacing.two,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroStatBig: {
    color: '#fff',
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  heroStatSmall: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Fonts.sans,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  phaseStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.one,
  },
  phaseItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseLabel: {
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // Quick actions
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.two,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontFamily: Fonts.rounded,
    fontSize: 12,
    lineHeight: 14,
  },
  // Tabs
  tabStripWrap: {
    borderBottomWidth: 1,
    paddingVertical: Spacing.two,
    zIndex: 10,
  },
  tabStripContent: {
    paddingHorizontal: Spacing.three,
    gap: 6,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabLabel: {
    fontSize: 13,
  },
  // Tab content
  tabContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardHeading: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  editLinkText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  // Travel card
  travelCard: {
    gap: Spacing.two,
  },
  travelDetails: {
    gap: Spacing.one,
  },
  travelDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  travelKey: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    width: 56,
  },
  travelVal: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  emptyTravel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: Spacing.two,
  },
  // Summary card
  summaryCard: {
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summaryChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.two,
    alignItems: 'center',
    gap: 2,
  },
  summaryChipNum: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
  },
  summaryChipLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  // Recent expenses
  recentCard: {
    gap: Spacing.two,
  },
  recentList: {
    gap: Spacing.two,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  recentIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentInfo: {
    flex: 1,
    gap: 2,
  },
  recentTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  recentMeta: {
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  recentAmount: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
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
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
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
  balanceAmount: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
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
