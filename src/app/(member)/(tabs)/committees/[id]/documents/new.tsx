import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { createCommitteeDocument, getCommitteeDetail } from '@/features/committees/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestContentJson } from '@/lib/api/client';
import type {
  CommitteeDocumentCategory,
  ExternalDocKind,
} from '@shared/contracts/committees-contract';

const CATEGORIES: { value: CommitteeDocumentCategory; label: string }[] = [
  { value: 'AGENDA', label: 'Agenda' },
  { value: 'MINUTES', label: 'Minutes' },
  { value: 'BUDGET', label: 'Budget' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'PHOTO', label: 'Photo' },
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'CHECKLIST', label: 'Checklist' },
  { value: 'OTHER', label: 'Other' },
];

function detectKind(url: string): ExternalDocKind {
  const u = url.toLowerCase();
  if (u.includes('drive.google.com') || u.includes('docs.google.com')) return 'GOOGLE_DRIVE';
  if (u.includes('dropbox.com')) return 'DROPBOX';
  if (u.includes('figma.com')) return 'FIGMA';
  if (u.includes('canva.com')) return 'CANVA';
  return 'OTHER_LINK';
}

function formatSize(bytes: number | null) {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1000;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type Source = 'link' | 'file';

type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
};

export default function NewDocumentScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const params = useLocalSearchParams<{ id: string }>();
  const committeeId = Number.parseInt(String(params.id), 10);
  const getValidAccessToken = useAuthStore((s) => s.getValidAccessToken);
  const queryClient = useQueryClient();

  const [source, setSource] = React.useState<Source>('link');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [externalUrl, setExternalUrl] = React.useState('');
  const [category, setCategory] = React.useState<CommitteeDocumentCategory>('OTHER');
  const [picked, setPicked] = React.useState<PickedFile | null>(null);

  const detailQuery = useQuery({
    queryKey: ['committees', committeeId, 'detail'],
    enabled: Number.isFinite(committeeId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');
      return getCommitteeDetail(token, committeeId);
    },
  });

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size != null && asset.size > MAX_UPLOAD_BYTES) {
        Alert.alert(
          'File too large',
          `Please pick a file under ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
        );
        return;
      }
      const guessedName = asset.name ?? `upload-${Date.now()}`;
      setPicked({
        uri: asset.uri,
        name: guessedName,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        size: asset.size ?? null,
      });
      if (!title.trim()) {
        setTitle(guessedName.replace(/\.[^.]+$/, '').slice(0, MAX_TITLE));
      }
    } catch (err) {
      Alert.alert('Could not pick file', err instanceof Error ? err.message : 'Try again.');
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');

      if (source === 'link') {
        const url = externalUrl.trim();
        return createCommitteeDocument(token, committeeId, {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          externalUrl: url,
          externalKind: detectKind(url),
        });
      }

      if (!picked) throw new Error('No file selected');

      const presign = await requestContentJson<{
        uploadUrl: string;
        publicUrl: string;
        key: string;
      }>('/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: picked.name, contentType: picked.mimeType }),
      });

      const fileRes = await fetch(picked.uri);
      const blob = await fileRes.blob();
      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': picked.mimeType },
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }

      return createCommitteeDocument(token, committeeId, {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        s3Key: presign.key,
        mimeType: picked.mimeType,
        sizeBytes: picked.size ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committees', committeeId, 'documents'] });
      router.back();
    },
    onError: (err: Error) => Alert.alert('Could not add document', err.message),
  });

  const trimmedTitle = title.trim();
  const trimmedUrl = externalUrl.trim();
  const isValidUrl = /^https?:\/\//i.test(trimmedUrl);
  const titleTooLong = trimmedTitle.length > MAX_TITLE;
  const descTooLong = description.trim().length > MAX_DESCRIPTION;
  const sourceReady = source === 'link' ? isValidUrl : !!picked;
  const canSubmit =
    trimmedTitle.length > 0 &&
    sourceReady &&
    !titleTooLong &&
    !descTooLong &&
    !createMutation.isPending;

  return (
    <Screen scroll>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: Spacing.three, paddingBottom: 124 }}>
        <BackLink label="Cancel" />
        <SectionTitle title="Add document" subtitle={detailQuery.data?.name} />

        <View style={styles.toggleRow}>
          {(['link', 'file'] as Source[]).map((mode) => {
            const active = mode === source;
            return (
              <Pressable
                key={mode}
                onPress={() => setSource(mode)}
                style={({ pressed }) => [
                  styles.toggleChip,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.accent : colors.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <Ionicons
                  name={mode === 'link' ? 'link-outline' : 'cloud-upload-outline'}
                  size={14}
                  color={active ? colors.background : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.toggleText,
                    { color: active ? colors.background : colors.textSecondary },
                  ]}>
                  {mode === 'link' ? 'Link' : 'Upload file'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
          <TextInput
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, MAX_TITLE + 50))}
            placeholder="e.g. Anchor sponsorship agreement"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          />
          <Text style={[styles.count, { color: titleTooLong ? colors.danger : colors.textMuted }]}>
            {trimmedTitle.length} / {MAX_TITLE}
          </Text>
        </Card>

        {source === 'link' ? (
          <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Link</Text>
            <TextInput
              value={externalUrl}
              onChangeText={setExternalUrl}
              placeholder="https://"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            />
            <Text style={[styles.helper, { color: colors.textMuted }]}>
              Paste a link to Google Drive, Dropbox, Figma, Canva, or any URL.
            </Text>
          </Card>
        ) : (
          <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>File</Text>
            <Pressable
              onPress={pickFile}
              disabled={createMutation.isPending}
              style={({ pressed }) => [
                styles.fileBox,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              {picked ? (
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                    {picked.name}
                  </Text>
                  <Text style={[styles.helper, { color: colors.textMuted }]}>
                    {picked.mimeType}
                    {formatSize(picked.size) ? ` · ${formatSize(picked.size)}` : ''}
                  </Text>
                </View>
              ) : (
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.fileName, { color: colors.textSecondary }]}>
                    Tap to choose a file
                  </Text>
                  <Text style={[styles.helper, { color: colors.textMuted }]}>
                    PDF, image, or document up to{' '}
                    {Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB
                  </Text>
                </View>
              )}
              <Ionicons
                name={picked ? 'swap-horizontal-outline' : 'cloud-upload-outline'}
                size={20}
                color={colors.accent}
              />
            </Pressable>
          </Card>
        )}

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => {
              const active = c.value === category;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active ? colors.accent : colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.background : colors.textSecondary },
                    ]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Any context the committee should know"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.textarea,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          />
          <Text style={[styles.count, { color: descTooLong ? colors.danger : colors.textMuted }]}>
            {description.trim().length} / {MAX_DESCRIPTION}
          </Text>
        </Card>

        <PrimaryButton
          onPress={() => createMutation.mutate()}
          disabled={!canSubmit}
          busy={createMutation.isPending}>
          {source === 'file' && createMutation.isPending ? 'Uploading…' : 'Add document'}
        </PrimaryButton>
        {createMutation.isPending && source === 'file' ? (
          <ActivityIndicator color={colors.accent} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  fileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
  },
  fileName: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  count: {
    alignSelf: 'flex-end',
    fontSize: 12,
  },
  helper: {
    fontSize: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
  },
});
