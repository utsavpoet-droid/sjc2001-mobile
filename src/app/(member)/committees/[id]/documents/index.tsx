import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  archiveCommitteeDocument,
  getCommitteeDetail,
  getCommitteeDocumentDownloadUrl,
  getCommitteeDocuments,
} from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type {
  CommitteeDocumentCategory,
  CommitteeDocumentDto,
  ExternalDocKind,
} from '@shared/contracts/committees-contract';

const CATEGORY_LABEL: Record<CommitteeDocumentCategory, string> = {
  AGENDA: 'Agenda',
  MINUTES: 'Minutes',
  BUDGET: 'Budget',
  CONTRACT: 'Contract',
  DESIGN: 'Design',
  PHOTO: 'Photo',
  RECEIPT: 'Receipt',
  CHECKLIST: 'Checklist',
  OTHER: 'Other',
};

const CATEGORY_ORDER: CommitteeDocumentCategory[] = [
  'AGENDA',
  'MINUTES',
  'BUDGET',
  'CONTRACT',
  'DESIGN',
  'PHOTO',
  'RECEIPT',
  'CHECKLIST',
  'OTHER',
];

const EXTERNAL_LABEL: Record<ExternalDocKind, string> = {
  GOOGLE_DRIVE: 'Google Drive',
  DROPBOX: 'Dropbox',
  FIGMA: 'Figma',
  CANVA: 'Canva',
  OTHER_LINK: 'Link',
};

function iconForDocument(doc: CommitteeDocumentDto): keyof typeof Ionicons.glyphMap {
  if (doc.externalUrl) {
    if (doc.externalKind === 'GOOGLE_DRIVE') return 'logo-google';
    if (doc.externalKind === 'DROPBOX') return 'cloud-outline';
    if (doc.externalKind === 'FIGMA') return 'color-palette-outline';
    if (doc.externalKind === 'CANVA') return 'brush-outline';
    return 'link-outline';
  }
  if (doc.mimeType?.startsWith('image/')) return 'image-outline';
  if (doc.mimeType === 'application/pdf') return 'document-text-outline';
  return 'document-outline';
}

function formatSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocRow({
  doc,
  canManage,
  onOpen,
  onArchive,
}: {
  doc: CommitteeDocumentDto;
  canManage: boolean;
  onOpen: () => void;
  onArchive: () => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const sizeLabel = formatSize(doc.sizeBytes);
  const uploaderName = doc.uploadedBy?.member?.name ?? 'Member';
  const created = new Date(doc.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <Card style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name={iconForDocument(doc)} size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {doc.title}
            </Text>
            {doc.version > 1 ? (
              <Text style={[styles.versionTag, { color: colors.textMuted }]}>v{doc.version}</Text>
            ) : null}
          </View>
          {doc.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
              {doc.description}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {uploaderName} · {created}
            </Text>
            {sizeLabel ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}> · {sizeLabel}</Text>
            ) : null}
            {doc.externalKind ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {' '}
                · {EXTERNAL_LABEL[doc.externalKind]}
              </Text>
            ) : null}
          </View>
        </View>
        {canManage ? (
          <Pressable
            onPress={onArchive}
            hitSlop={8}
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        )}
      </Card>
    </Pressable>
  );
}

export default function CommitteeDocumentsScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string }>();
  const committeeId = Number.parseInt(String(params.id), 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ['committees', committeeId, 'detail'],
    enabled: Number.isFinite(committeeId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeDetail(token, committeeId);
    },
  });

  const docsQuery = useQuery({
    queryKey: ['committees', committeeId, 'documents'],
    enabled: Number.isFinite(committeeId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeDocuments(token, committeeId);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (docId: number) => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return archiveCommitteeDocument(token, committeeId, docId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'documents'] });
    },
    onError: (err: Error) => Alert.alert('Could not archive document', err.message),
  });

  const docs = docsQuery.data ?? [];
  const canManage =
    detailQuery.data?.caller.isChair ||
    detailQuery.data?.caller.isEditor ||
    detailQuery.data?.caller.isSuperAdmin;
  const canCreate = canManage;

  const grouped = React.useMemo(() => {
    const map = new Map<CommitteeDocumentCategory, CommitteeDocumentDto[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const d of docs) {
      const cat = (CATEGORY_ORDER as string[]).includes(d.category) ? d.category : 'OTHER';
      const list = map.get(cat as CommitteeDocumentCategory) ?? [];
      list.push(d);
      map.set(cat as CommitteeDocumentCategory, list);
    }
    return CATEGORY_ORDER.map((cat) => ({ cat, items: map.get(cat) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [docs]);

  const openDoc = async (doc: CommitteeDocumentDto) => {
    if (doc.externalUrl) {
      Linking.openURL(doc.externalUrl).catch(() => Alert.alert('Could not open link'));
      return;
    }
    if (doc.s3Key) {
      try {
        const token = await getValidAccessToken();
        if (!token) throw new Error('Not authenticated');
        const { downloadUrl } = await getCommitteeDocumentDownloadUrl(token, committeeId, doc.id);
        Linking.openURL(downloadUrl).catch(() => Alert.alert('Could not open file'));
      } catch (err) {
        Alert.alert('Download failed', err instanceof Error ? err.message : 'Try again.');
      }
      return;
    }
    Alert.alert('Nothing to open', 'This document has no attachment or link.');
  };

  const confirmArchive = (doc: CommitteeDocumentDto) => {
    Alert.alert('Archive document?', `"${doc.title}" will be removed from the list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => archiveMutation.mutate(doc.id),
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={docsQuery.isRefetching}
            onRefresh={() => void docsQuery.refetch()}
            tintColor={colors.accent}
          />
        }>
        <BackLink label="Back" />
        <SectionTitle title="Documents" subtitle={detailQuery.data?.name} />

        {canCreate ? (
          <Pressable
            onPress={() => router.push(`/(member)/committees/${committeeId}/documents/new`)}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Ionicons name="add" size={18} color={colors.background} />
            <Text style={[styles.ctaText, { color: colors.background }]}>Add document</Text>
          </Pressable>
        ) : null}

        {docsQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}

        {docs.length === 0 && !docsQuery.isLoading ? (
          <Card style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No documents shared yet.
            </Text>
          </Card>
        ) : null}

        {grouped.map(({ cat, items }) => (
          <View key={cat} style={{ gap: Spacing.two }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {CATEGORY_LABEL[cat]} · {items.length}
            </Text>
            {items.map((d) => (
              <DocRow
                key={d.id}
                doc={d}
                canManage={!!canManage}
                onOpen={() => openDoc(d)}
                onArchive={() => confirmArchive(d)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
    paddingBottom: 124,
  },
  sectionLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.two,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  versionTag: {
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 11,
  },
  empty: {
    padding: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
});
