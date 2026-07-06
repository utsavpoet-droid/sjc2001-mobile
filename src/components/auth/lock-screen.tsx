import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { GhostButton, PrimaryButton } from '@/components/ui/primitives';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useColorScheme } from '@/hooks/use-color-scheme';

const silverCircleLogo = require('../../../assets/branding/silver-circle-25.png');

export function LockScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const biometricLabel = useAuthStore((state) => state.biometricLabel);
  const unlockWithBiometrics = useAuthStore((state) => state.unlockWithBiometrics);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const tryUnlock = React.useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await unlockWithBiometrics();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [unlockWithBiometrics]);

  useEffect(() => {
    void tryUnlock();
    // Mount-only auto-prompt: re-prompts after cancel are user-initiated via the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !busyRef.current) {
        void tryUnlock();
      }
    });
    return () => sub.remove();
  }, [tryUnlock]);

  const handleSwitchAccount = () => {
    Alert.alert(
      'Sign in with password?',
      'You will be signed out of this device and need your member credentials.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/sign-in' as never);
          },
        },
      ],
    );
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Image source={silverCircleLogo} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.title, { color: colors.text }]}>Silver Circle</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {user?.name ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Welcome back.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton busy={busy} onPress={() => void tryUnlock()}>
          Unlock with {biometricLabel ?? 'Face ID'}
        </PrimaryButton>
        <GhostButton onPress={handleSwitchAccount}>Sign in with password</GhostButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: Spacing.six,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
  },
  logo: {
    width: 220,
    height: 220,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 28,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
});
