import { useMutation } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/ui/back-link';
import { Card, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import {
  postMemberChangePassword,
  postMemberTotpDisable,
  postMemberTotpSetup,
  postMemberTotpVerify,
} from '@/features/member/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { registerDeviceForPush, requestPushPermissions } from '@/lib/notifications/push';

export default function SettingsScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const getValidAccessToken = useAuthStore((state) => state.getValidAccessToken);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const busy = useAuthStore((state) => state.busy);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpStep, setTotpStep] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [totpCode, setTotpCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(Boolean(user?.totpEnabled));
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postMemberChangePassword(token, { currentPassword, newPassword });
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your password has been changed successfully.');
    },
    onError: (error) => {
      Alert.alert('Unable to change password', error instanceof Error ? error.message : 'Try again.');
    },
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postMemberTotpSetup(token);
    },
    onSuccess: (data) => {
      setQrCodeUrl(data.qrCodeUrl);
      setSecret(data.secret);
      setTotpStep('setup');
      setTotpCode('');
    },
    onError: (error) => {
      Alert.alert('Unable to set up MFA', error instanceof Error ? error.message : 'Try again.');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postMemberTotpVerify(token, totpCode);
    },
    onSuccess: () => {
      setTotpEnabled(true);
      setTotpStep('idle');
      setTotpCode('');
      Alert.alert('MFA enabled', 'Two-factor authentication is now active.');
    },
    onError: (error) => {
      Alert.alert('Unable to verify MFA', error instanceof Error ? error.message : 'Try again.');
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');
      return postMemberTotpDisable(token, totpCode);
    },
    onSuccess: () => {
      setTotpEnabled(false);
      setTotpStep('idle');
      setTotpCode('');
      Alert.alert('MFA disabled', 'Two-factor authentication has been turned off.');
    },
    onError: (error) => {
      Alert.alert('Unable to disable MFA', error instanceof Error ? error.message : 'Try again.');
    },
  });

  const notificationsMutation = useMutation({
    mutationFn: async () => {
      const permission = await requestPushPermissions();
      if (!permission.granted) {
        throw new Error('Notifications are turned off for Silver Circle on this device.');
      }

      const token = await getValidAccessToken();
      if (!token) throw new Error('Please sign in again.');

      const result = await registerDeviceForPush(token);
      if (!result.registered) {
        throw new Error('Unable to enable notifications right now.');
      }

      return result;
    },
    onSuccess: () => {
      setNotificationsEnabled(true);
      Alert.alert('Notifications enabled', 'Silver Circle can now send updates to this device.');
    },
    onError: (error) => {
      Alert.alert('Unable to enable notifications', error instanceof Error ? error.message : 'Try again.');
    },
  });

  const passwordDisabled = useMemo(
    () => !currentPassword || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword,
    [confirmPassword, currentPassword, newPassword],
  );

  const handleLogout = () => {
    Alert.alert('Sign out?', 'You can sign back in any time with your member credentials.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <BackLink label="Back to account" />
      <SectionTitle
        eyebrow="Settings"
        title="Password and security"
        subtitle="Manage your password and multi-factor authentication from the app."
      />

      <Card style={styles.section}>
        <Text style={[styles.heading, { color: colors.text }]}>Change password</Text>
        <Input value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" secureTextEntry />
        <Input value={newPassword} onChangeText={setNewPassword} placeholder="New password" secureTextEntry />
        <Input value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" secureTextEntry />
        <PrimaryButton busy={passwordMutation.isPending} disabled={passwordDisabled} onPress={() => passwordMutation.mutate()}>
          Update Password
        </PrimaryButton>
      </Card>

      <Card style={styles.section}>
        <Text style={[styles.heading, { color: colors.text }]}>Multi-factor authentication</Text>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {totpEnabled ? 'MFA is active on your account.' : 'Add an authenticator app for stronger sign-in security.'}
        </Text>

        {totpStep === 'idle' ? (
          <View style={styles.section}>
            {!totpEnabled ? (
              <PrimaryButton busy={setupMutation.isPending} onPress={() => setupMutation.mutate()}>
                Enable MFA
              </PrimaryButton>
            ) : (
              <PrimaryButton onPress={() => setTotpStep('disable')}>Disable MFA</PrimaryButton>
            )}
          </View>
        ) : null}

        {totpStep === 'setup' ? (
          <View style={styles.section}>
            {!qrCodeUrl ? <ActivityIndicator color={colors.accent} /> : <Image source={{ uri: qrCodeUrl }} style={styles.qr} resizeMode="contain" />}
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Secret: {secret}</Text>
            <Input value={totpCode} onChangeText={setTotpCode} placeholder="6-digit code" keyboardType="number-pad" />
            <PrimaryButton busy={verifyMutation.isPending} disabled={totpCode.trim().length !== 6} onPress={() => verifyMutation.mutate()}>
              Verify and Enable
            </PrimaryButton>
          </View>
        ) : null}

        {totpStep === 'disable' ? (
          <View style={styles.section}>
            <Input value={totpCode} onChangeText={setTotpCode} placeholder="Current 6-digit code" keyboardType="number-pad" />
            <PrimaryButton busy={disableMutation.isPending} disabled={totpCode.trim().length !== 6} onPress={() => disableMutation.mutate()}>
              Confirm Disable
            </PrimaryButton>
          </View>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <Text style={[styles.heading, { color: colors.text }]}>Notifications</Text>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {notificationsEnabled
            ? 'Push notifications are enabled for this device.'
            : 'Turn on notifications to hear about new activity in Silver Circle.'}
        </Text>
        <PrimaryButton
          busy={notificationsMutation.isPending}
          disabled={notificationsEnabled}
          onPress={() => notificationsMutation.mutate()}
        >
          {notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
        </PrimaryButton>
      </Card>

      <Card style={styles.section}>
        <Text style={[styles.heading, { color: colors.text }]}>Session</Text>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          Sign out of Silver Circle on this device when you are done.
        </Text>
        <PrimaryButton busy={busy} onPress={handleLogout}>
          Sign out
        </PrimaryButton>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  heading: {
    fontFamily: Fonts.rounded,
    fontSize: 20,
  },
  caption: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  qr: {
    width: 220,
    height: 220,
    alignSelf: 'center',
  },
});
