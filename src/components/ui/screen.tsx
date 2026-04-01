import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';

import { BottomTabInset, Colors, Spacing, resolveThemeMode } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ViewStyle;
} & Pick<ScrollViewProps, 'keyboardShouldPersistTaps'>;

export function Screen({
  children,
  scroll = false,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
}: ScreenProps) {
  const colors = Colors[resolveThemeMode(useColorScheme())];

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }] }>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}>
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    paddingBottom: BottomTabInset + 28,
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: BottomTabInset + 28,
    gap: Spacing.three,
  },
});
