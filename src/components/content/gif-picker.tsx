import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { Card, GhostButton, Input } from '@/components/ui/primitives';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { getGifs } from '@/features/content/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveBackendUrl } from '@/lib/api/bases';

export function GifPicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const [query, setQuery] = useState('');
  const gifsQuery = useQuery({
    queryKey: ['gif-picker', query.trim()],
    queryFn: () => getGifs({ q: query.trim() || undefined, limit: 18 }),
    enabled: visible,
  });

  const gifs = (gifsQuery.data?.gifs ?? []).filter((gif) => gif.previewUrl && gif.url);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}> 
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}> 
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Add a GIF</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Input value={query} onChangeText={setQuery} placeholder="Search GIPHY" />

          {gifsQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}
          {gifsQuery.data?.error ? <Text style={[styles.note, { color: colors.textSecondary }]}>{gifsQuery.data.error}</Text> : null}

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {gifs.map((gif) => {
              const previewUri = resolveBackendUrl(gif.previewUrl);
              if (!previewUri) return null;
              return (
                <Pressable
                  key={gif.id}
                  onPress={() => {
                    onSelect(gif.url);
                    onClose();
                  }}>
                  {({ pressed }) => (
                    <Card style={[styles.gifCard, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}> 
                      <Image source={{ uri: previewUri }} style={styles.gif} contentFit="cover" recyclingKey={previewUri} />
                    </Card>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <GhostButton onPress={onClose}>Done</GhostButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 24,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  gifCard: {
    width: 148,
    padding: Spacing.two,
    borderRadius: 22,
  },
  gif: {
    width: '100%',
    height: 112,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});
