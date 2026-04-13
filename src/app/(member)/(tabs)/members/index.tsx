import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { Avatar, Card, GhostButton, Input, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getBulkEngagement, getMembersPage, postReactionToggle, searchMembers } from '@/features/content/api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mapMemberSummaryFromWire } from '@/lib/api/wire-alignment';

type MemberSummary = ReturnType<typeof mapMemberSummaryFromWire> & {
  isJoining?: boolean;
  contributionAmount?: string | null;
};

type AlphaRange = {
  label: string;
  start: string;
  end: string;
};

const alphaRanges: AlphaRange[] = [
  { label: 'A-D', start: 'A', end: 'D' },
  { label: 'E-H', start: 'E', end: 'H' },
  { label: 'I-L', start: 'I', end: 'L' },
  { label: 'M-P', start: 'M', end: 'P' },
  { label: 'Q-T', start: 'Q', end: 'T' },
  { label: 'U-Z', start: 'U', end: 'Z' },
];

function normalizeMembersList(raw: unknown): MemberSummary[] {
  if (!raw || typeof raw !== 'object') return [];
  const members = (raw as { members?: Record<string, unknown>[] }).members ?? [];
  return members.map((item) => {
    const base = mapMemberSummaryFromWire(item);
    return {
      ...base,
      isJoining: typeof item.isJoining === 'boolean' ? item.isJoining : undefined,
      contributionAmount:
        item.contributionAmount === undefined || item.contributionAmount === null
          ? null
          : String(item.contributionAmount),
    };
  });
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b));
}

function toggleSelection(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function MemberStat({
  icon,
  count,
  active,
  inverted,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  active?: boolean;
  inverted?: boolean;
  onPress?: () => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const backgroundColor = active
    ? inverted
      ? '#F1D7CA'
      : colors.accentSoft
    : inverted
      ? 'rgba(255,255,255,0.14)'
      : colors.surface;
  const borderColor = active
    ? inverted
      ? '#F1D7CA'
      : colors.accent
    : inverted
      ? 'rgba(255,255,255,0.22)'
      : colors.border;
  const iconColor = active
    ? inverted
      ? '#172236'
      : colors.accent
    : inverted
      ? '#F3CEBC'
      : colors.textSecondary;
  const textColor = active
    ? inverted
      ? '#172236'
      : colors.accent
    : inverted
      ? '#FFF4ED'
      : colors.text;

  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress?.();
      }}
      style={[styles.statAction, { backgroundColor, borderColor }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.statCount, { color: textColor }]}>{count}</Text>
    </Pressable>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? colors.accentSoft : colors.surfaceMuted,
          borderColor: active ? colors.accent : colors.border,
        },
      ]}>
      <Text style={[styles.filterChipText, { color: active ? colors.accent : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function openProfile(memberId: string, event?: GestureResponderEvent) {
  event?.stopPropagation();
  router.push(`/(member)/members/${memberId}` as Href);
}

export default function MembersScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const accessToken = useAuthStore((state) => state.accessToken);
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [countryFilters, setCountryFilters] = useState<string[]>([]);
  const [stateFilters, setStateFilters] = useState<string[]>([]);
  const [joiningFilter, setJoiningFilter] = useState<'joining' | 'not-joining' | null>(null);
  const [contributedFilter, setContributedFilter] = useState<'contributed' | 'not-contributed' | null>(null);
  const [alphaRange, setAlphaRange] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['members', 'directory'],
    queryFn: () => getMembersPage({ page: 1, limit: 500 }),
  });

  const searchQuery = useQuery({
    queryKey: ['members', 'search', query],
    queryFn: () => searchMembers({ q: query.trim(), limit: 40 }),
    enabled: query.trim().length >= 2,
  });

  const reactionMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postReactionToggle(token, { entityType: 'member', entityId: memberId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['member-engagement'] });
    },
    onError: (error) => {
      Alert.alert('Unable to react', error instanceof Error ? error.message : 'Try again.');
    },
  });

  const fullDirectoryMembers = useMemo(() => normalizeMembersList(listQuery.data), [listQuery.data]);

  const baseMembers = useMemo(() => {
    if (query.trim().length < 2) return fullDirectoryMembers;

    const fullById = new Map(fullDirectoryMembers.map((member) => [member.id, member]));
    return normalizeMembersList(searchQuery.data).map((member) => ({
      ...(fullById.get(member.id) ?? {}),
      ...member,
      isJoining: member.isJoining ?? fullById.get(member.id)?.isJoining,
      contributionAmount: member.contributionAmount ?? fullById.get(member.id)?.contributionAmount ?? null,
      avatar_url: member.avatar_url || fullById.get(member.id)?.avatar_url || null,
      location_label: member.location_label || fullById.get(member.id)?.location_label || null,
    }));
  }, [fullDirectoryMembers, query, searchQuery.data]);

  const membersByCountry = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const member of baseMembers) {
      if (!member.country) continue;
      const set = map.get(member.country) ?? new Set<string>();
      if (member.city) set.add(member.city);
      map.set(member.country, set);
    }
    return map;
  }, [baseMembers]);

  const countriesForState = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const member of baseMembers) {
      if (!member.city || !member.country) continue;
      const set = map.get(member.city) ?? new Set<string>();
      set.add(member.country);
      map.set(member.city, set);
    }
    return map;
  }, [baseMembers]);

  const selectedCountries = useMemo(() => {
    if (stateFilters.length === 0) return countryFilters;
    const derived = new Set(countryFilters);
    for (const state of stateFilters) {
      for (const country of countriesForState.get(state) ?? []) {
        derived.add(country);
      }
    }
    return [...derived];
  }, [countryFilters, stateFilters, countriesForState]);

  const visibleCountryOptions = useMemo(() => {
    if (stateFilters.length === 0) return uniqueSorted(baseMembers.map((member) => member.country));
    return uniqueSorted(selectedCountries);
  }, [baseMembers, selectedCountries, stateFilters.length]);

  const visibleStateOptions = useMemo(() => {
    if (selectedCountries.length === 0) return uniqueSorted(baseMembers.map((member) => member.city));
    const states = selectedCountries.flatMap((country) => [...(membersByCountry.get(country) ?? new Set<string>())]);
    return uniqueSorted(states);
  }, [baseMembers, membersByCountry, selectedCountries]);

  const engagementQuery = useQuery({
    queryKey: ['member-engagement', baseMembers.map((member) => member.id).join(','), accessToken],
    queryFn: () => getBulkEngagement('member', baseMembers.map((member) => member.id), accessToken),
    enabled: baseMembers.length > 0,
  });

  const members = useMemo(() => {
    return baseMembers.filter((member) => {
      const firstLetter = member.display_name.trim().charAt(0).toUpperCase();
      const selectedRange = alphaRanges.find((range) => range.label === alphaRange);
      const matchesCountry = selectedCountries.length === 0 || selectedCountries.includes(member.country ?? '');
      const matchesState = stateFilters.length === 0 || stateFilters.includes(member.city ?? '');
      const matchesJoining =
        !joiningFilter ||
        (joiningFilter === 'joining' ? member.isJoining === true : member.isJoining === false || member.isJoining === undefined);
      const matchesContributed =
        !contributedFilter ||
        (contributedFilter === 'contributed' ? Boolean(member.contributionAmount) : !member.contributionAmount);
      const matchesAlpha = !selectedRange || (firstLetter >= selectedRange.start && firstLetter <= selectedRange.end);
      return matchesCountry && matchesState && matchesJoining && matchesContributed && matchesAlpha;
    });
  }, [alphaRange, baseMembers, contributedFilter, joiningFilter, selectedCountries, stateFilters]);

  const contributorCount = useMemo(() => members.filter((member) => Boolean(member.contributionAmount)).length, [members]);
  const joiningCount = useMemo(() => members.filter((member) => member.isJoining).length, [members]);
  const loading = listQuery.isLoading || searchQuery.isLoading || engagementQuery.isLoading;

  const header = (
    <View style={styles.headerStack}>
      <SectionTitle
        eyebrow="Directory"
        title="The people behind the Silver Circle"
        subtitle="From classmates to conversations — like, comment, reconnect."
      />

      <Card style={[styles.overviewCard, styles.deepSurfaceCard]}>
        <View style={styles.overviewRow}>
          <View style={styles.overviewCopy}>
            <Text style={styles.overviewKicker}>Live directory</Text>
            <Text style={styles.overviewTitle}>From classmates to conversations — like, comment, reconnect.</Text>
          </View>
          <View style={[styles.overviewBadge, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Ionicons name="sparkles" size={14} color="#F4D6C9" />
          </View>
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{members.length}</Text>
            <Text style={styles.metricLabel}>Visible members</Text>
          </View>
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{contributorCount}</Text>
            <Text style={styles.metricLabel}>Contributors</Text>
          </View>
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{joiningCount}</Text>
            <Text style={styles.metricLabel}>Joining</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.searchCard}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Input value={query} onChangeText={setQuery} placeholder="Search members" autoCapitalize="words" />
          </View>
          <GhostButton onPress={() => setShowFilters((value) => !value)}>
            {showFilters ? 'Hide filters' : 'Filter'}
          </GhostButton>
        </View>
      </Card>

      {showFilters ? (
        <Card style={[styles.filterCard, { backgroundColor: colors.backgroundSoft }] }>
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Country</Text>
            <View style={styles.filterWrap}>
              <FilterChip label="All" active={selectedCountries.length === 0} onPress={() => setCountryFilters([])} />
              {visibleCountryOptions.map((option) => {
                const active = selectedCountries.includes(option);
                return (
                  <FilterChip
                    key={option}
                    label={option}
                    active={active}
                    onPress={() => {
                      const nextCountries = toggleSelection(countryFilters, option);
                      const derivedCountries = new Set(nextCountries);
                      for (const state of stateFilters) {
                        for (const country of countriesForState.get(state) ?? []) {
                          derivedCountries.add(country);
                        }
                      }
                      setCountryFilters(nextCountries);
                      if (derivedCountries.size > 0) {
                        setStateFilters((current) =>
                          current.filter((state) => {
                            const stateCountries = countriesForState.get(state) ?? new Set<string>();
                            return [...stateCountries].some((country) => derivedCountries.has(country));
                          }),
                        );
                      }
                    }}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>State / City</Text>
            <View style={styles.filterWrap}>
              <FilterChip label="All" active={stateFilters.length === 0} onPress={() => setStateFilters([])} />
              {visibleStateOptions.map((option) => (
                <FilterChip
                  key={option}
                  label={option}
                  active={stateFilters.includes(option)}
                  onPress={() => {
                    const nextStates = toggleSelection(stateFilters, option);
                    setStateFilters(nextStates);
                    if (nextStates.length > 0) {
                      const forcedCountries = new Set(countryFilters);
                      for (const state of nextStates) {
                        for (const country of countriesForState.get(state) ?? []) {
                          forcedCountries.add(country);
                        }
                      }
                      setCountryFilters([...forcedCountries]);
                    }
                  }}
                />
              ))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Joining</Text>
            <View style={styles.filterWrap}>
              <FilterChip label="All" active={!joiningFilter} onPress={() => setJoiningFilter(null)} />
              <FilterChip label="Joining" active={joiningFilter === 'joining'} onPress={() => setJoiningFilter('joining')} />
              <FilterChip label="Not joining" active={joiningFilter === 'not-joining'} onPress={() => setJoiningFilter('not-joining')} />
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Contributed</Text>
            <View style={styles.filterWrap}>
              <FilterChip label="All" active={!contributedFilter} onPress={() => setContributedFilter(null)} />
              <FilterChip label="Contributed" active={contributedFilter === 'contributed'} onPress={() => setContributedFilter('contributed')} />
              <FilterChip label="Not contributed" active={contributedFilter === 'not-contributed'} onPress={() => setContributedFilter('not-contributed')} />
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Alphabet</Text>
            <View style={styles.filterWrap}>
              <FilterChip label="All" active={!alphaRange} onPress={() => setAlphaRange(null)} />
              {alphaRanges.map((range) => (
                <FilterChip key={range.label} label={range.label} active={alphaRange === range.label} onPress={() => setAlphaRange(range.label)} />
              ))}
            </View>
          </View>
        </Card>
      ) : null}

      {loading ? <ActivityIndicator color={colors.accent} /> : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={members}
        keyExtractor={(member) => member.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={8}
        removeClippedSubviews
        renderItem={({ item: member }) => {
          const contributor = Boolean(member.contributionAmount);
          const engagement = engagementQuery.data?.[Number(member.id)] ?? { reactionCount: 0, commentCount: 0, likedByMe: false };
          return (
            <Pressable key={member.id} onPress={() => openProfile(member.id)}>
              {({ pressed }) => (
                <Card
                  style={[
                    styles.memberCard,
                    contributor
                      ? {
                          backgroundColor: '#102035',
                          borderColor: '#24344D',
                          shadowColor: colors.accent,
                          shadowOpacity: 0.18,
                          shadowRadius: 20,
                          shadowOffset: { width: 0, height: 10 },
                          elevation: 10,
                        }
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                    { transform: [{ scale: pressed ? 0.988 : 1 }] },
                  ]}>
                  <View style={styles.memberHeaderRow}>
                    <View style={styles.memberTopRow}>
                      <Avatar
                        name={member.display_name}
                        uri={member.avatar_url}
                        focalX={member.avatar_focal_x}
                        focalY={member.avatar_focal_y}
                        size={76}
                      />
                      <View style={styles.memberText}>
                        <View style={styles.titleRow}>
                          <Text style={[styles.memberName, { color: contributor ? '#FFF7F1' : colors.text }]}>{member.display_name}</Text>
                          {member.isJoining ? (
                            <View style={[styles.joiningBadge, { backgroundColor: contributor ? 'rgba(255,255,255,0.1)' : colors.accentSoft }]}> 
                              <Ionicons name="sparkles" size={12} color={contributor ? '#F7D6C9' : colors.accent} />
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.metaRow}>
                          <Ionicons name="location" size={14} color={contributor ? '#F2C8B7' : colors.accent} />
                          <Text style={[styles.memberMeta, { color: contributor ? '#D9E0E8' : colors.textSecondary }]}>
                            {member.location_label || 'Location not shared'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.memberSignal, { color: contributor ? '#F3D4C5' : colors.textMuted }]}> 
                      {contributor ? 'Contributor spotlight' : 'Silver Circle member'}
                    </Text>
                  </View>

                  <View style={styles.footerRow}>
                    <View style={styles.statRow}>
                      <MemberStat
                        icon={engagement.likedByMe ? 'heart' : 'heart-outline'}
                        count={engagement.reactionCount}
                        active={engagement.likedByMe}
                        inverted={contributor}
                        onPress={() => reactionMutation.mutate(member.id)}
                      />
                      <MemberStat
                        icon={engagement.commentCount > 0 ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                        count={engagement.commentCount}
                        active={engagement.commentCount > 0}
                        inverted={contributor}
                        onPress={() => router.push(`/(member)/members/${member.id}` as Href)}
                      />
                    </View>
                  </View>
                </Card>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Card>
              <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>No members match the current search or filters.</Text>
            </Card>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  deepSurfaceCard: {
    backgroundColor: '#101F34',
    borderColor: '#24344D',
  },
  headerStack: {
    gap: Spacing.three,
  },
  listContent: {
    padding: Spacing.four,
    paddingBottom: 124,
    gap: Spacing.three,
  },
  overviewCard: {
    borderRadius: 34,
    gap: Spacing.three,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  overviewCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  overviewKicker: {
    color: '#FFD8C6',
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  overviewTitle: {
    color: '#FFF9F4',
    fontFamily: Fonts.rounded,
    fontSize: 28,
    lineHeight: 34,
  },
  overviewBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metricBlock: {
    flex: 1,
    gap: 2,
  },
  metricValue: {
    color: '#FFF9F4',
    fontFamily: Fonts.rounded,
    fontSize: 28,
  },
  metricLabel: {
    color: '#DDE5EE',
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  searchCard: {
    borderRadius: 28,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchWrap: {
    flex: 1,
  },
  filterCard: {
    gap: Spacing.three,
    borderRadius: 28,
  },
  filterGroup: {
    gap: Spacing.two,
  },
  filterLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
  memberCard: {
    gap: Spacing.three,
    borderRadius: 32,
  },
  memberHeaderRow: {
    gap: Spacing.two,
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  memberText: {
    flex: 1,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  memberName: {
    flex: 1,
    fontFamily: Fonts.rounded,
    fontSize: 24,
  },
  joiningBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberMeta: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 19,
  },
  memberSignal: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  profileLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  profileLink: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  statAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  statCount: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  emptyListText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
});
