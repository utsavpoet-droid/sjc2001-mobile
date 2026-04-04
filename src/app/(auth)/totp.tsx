import { router, Redirect, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Card, GhostButton, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TotpSignInScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const busy = useAuthStore((state) => state.busy);
  const errorMessage = useAuthStore((state) => state.errorMessage);
  const pendingChallenge = useAuthStore((state) => state.pendingTotpChallenge);
  const completeTotpSignIn = useAuthStore((state) => state.completeTotpSignIn);
  const clearPendingTotpChallenge = useAuthStore((state) => state.clearPendingTotpChallenge);
  const clearError = useAuthStore((state) => state.clearError);

  const [totpCode, setTotpCode] = useState('');
  const canSubmit = useMemo(() => totpCode.trim().length === 6, [totpCode]);

  if (!pendingChallenge) {
    return <Redirect href={'/(auth)/sign-in' as Href} />;
  }

  async function handleVerify() {
    clearError();
    try {
      const result = await completeTotpSignIn(totpCode);
      if (result.kind === 'signed_in') {
        router.replace('/(member)/(tabs)/home' as never);
      }
    } catch {
      // Auth store already exposes the user-facing error.
    }
  }

  function handleStartOver() {
    clearError();
    clearPendingTotpChallenge();
    setTotpCode('');
    router.replace('/(auth)/sign-in' as never);
  }

  return (
    <Screen scroll contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
      <View style={styles.heroWrap}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>SILVER CIRCLE SECURITY</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Enter your 6-digit verification code</Text>
        <Text style={[styles.heroCopy, { color: colors.textSecondary }]}>
          Your account has multi-factor authentication enabled. Open your authenticator app and enter the current code to finish signing in.
        </Text>
      </View>

      <Card style={styles.card}>
        <SectionTitle
          eyebrow="Two-Factor Authentication"
          title="Confirm it’s you"
          subtitle={`Signing in as ${pendingChallenge.identifier}`}
        />

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Authenticator code</Text>
          <Input
            value={totpCode}
            onChangeText={(value) => setTotpCode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={() => void handleVerify()}
            autoFocus
          />
        </View>

        {errorMessage ? <Text style={[styles.error, { color: colors.danger }]}>{errorMessage}</Text> : null}

        <PrimaryButton busy={busy} disabled={!canSubmit} onPress={() => void handleVerify()}>
          Verify and Sign In
        </PrimaryButton>

        <GhostButton onPress={handleStartOver}>
          Use a different account
        </GhostButton>

        <GhostButton
          onPress={() =>
            Alert.alert(
              'Need help?',
              'If your code is not working, make sure your device time is correct and try the latest code from your authenticator app.',
            )
          }
        >
          Trouble with the code?
        </GhostButton>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    minHeight: '100%',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingBottom: 120,
  },
  heroWrap: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  heroTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 34,
    lineHeight: 40,
  },
  heroCopy: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    gap: Spacing.three,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  error: {
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
});
