import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];

  return (
    <View style={styles.sectionTitle}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }, style]}>{children}</View>;
}

export function PrimaryButton({
  children,
  busy,
  ...props
}: PressableProps & { children: React.ReactNode; busy?: boolean }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];

  return (
    <Pressable
      {...props}
      disabled={props.disabled || busy}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.accent,
          opacity: props.disabled || busy ? 0.5 : pressed ? 0.82 : 1,
        },
      ]}>
      {busy ? <ActivityIndicator color={colors.background} /> : <Text style={[styles.buttonText, { color: colors.background }]}>{children}</Text>}
    </Pressable>
  );
}

export function GhostButton({
  children,
  ...props
}: PressableProps & { children: React.ReactNode }) {
  const colors = Colors[resolveThemeMode(useColorScheme())];

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.ghostButton,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        },
      ]}>
      <Text style={[styles.ghostText, { color: colors.text }]}>{children}</Text>
    </Pressable>
  );
}

export const Input = React.forwardRef<TextInput, TextInputProps>(function Input(props, ref) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        styles.input,
        {
          color: colors.text,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        props.style,
      ]}
    />
  );
});

export function Avatar({
  name,
  uri,
  size = 48,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceMuted,
        }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: colors.accent, fontFamily: Fonts.rounded, fontSize: size * 0.34 }}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 30,
    padding: Spacing.four,
    gap: Spacing.two,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  button: {
    minHeight: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonText: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  ghostButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  ghostText: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    fontFamily: Fonts.sans,
    fontSize: 16,
  },
});
