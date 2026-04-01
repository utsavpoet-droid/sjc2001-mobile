import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Card, GhostButton, Input, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { Colors, Fonts, Spacing, resolveThemeMode } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { getContentApiBase, joinBasePath } from '@/lib/api/bases';
import { useColorScheme } from '@/hooks/use-color-scheme';

const silverCircleLogo = require('../../../assets/branding/silver-circle-25.png');

export default function SignInScreen() {
  const colors = Colors[resolveThemeMode(useColorScheme())];
  const signIn = useAuthStore((state) => state.signIn);
  const busy = useAuthStore((state) => state.busy);
  const errorMessage = useAuthStore((state) => state.errorMessage);
  const clearError = useAuthStore((state) => state.clearError);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  async function handleSignIn() {
    clearError();
    try {
      const result = await signIn({
        identifier: identifier.trim(),
        password,
        deviceName: 'Mobile app',
        platform: Platform.OS,
      });

      if (result.kind === 'totp_required') {
        Alert.alert('Two-factor required', 'This account needs a TOTP code. That screen is the next member flow to wire.');
        return;
      }

      router.replace('/(member)/(tabs)/home' as never);
    } catch {
      // Store already captures the user-facing error.
    }
  }

  async function handleAccessRequest() {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim()) {
      Alert.alert('Missing details', 'Please fill in all four fields.');
      return;
    }

    setRequestBusy(true);
    try {
      const response = await fetch(joinBasePath(getContentApiBase(), '/access-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Unable to submit request right now.');
      }

      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setShowAccessRequest(false);
      Alert.alert('Request sent', 'Your access request has been submitted to the reunion admin.');
    } catch (error) {
      Alert.alert('Unable to submit', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRequestBusy(false);
    }
  }

  return (
    <Screen scroll contentContainerStyle={styles.signInContent} keyboardShouldPersistTaps="always">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.heroWrap}>
          <Image source={silverCircleLogo} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.brandTitle, { color: colors.text }]}>Silver Circle</Text>
          <Text style={[styles.brandCopy, { color: colors.textSecondary }]}>25 years. One circle. The member app for your batch stories, people, albums, and updates.</Text>
        </View>

        <Card style={styles.formCard}>
          <SectionTitle
            eyebrow="Member Access"
            title="Welcome back"
            subtitle="Use the same member credentials you use on the website."
          />

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Username or email</Text>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Enter username or email"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Password</Text>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={() => void handleSignIn()}
            />
          </View>

          {errorMessage ? <Text style={[styles.error, { color: colors.danger }]}>{errorMessage}</Text> : null}

          <PrimaryButton
            busy={busy}
            disabled={!identifier.trim() || !password}
            onPress={() => void handleSignIn()}>
            Sign In
          </PrimaryButton>

          <GhostButton onPress={() => setShowAccessRequest((value) => !value)}>
            Forgotten password or need access? Click here.
          </GhostButton>
        </Card>

        {showAccessRequest ? (
          <Card style={styles.formCard}>
            <SectionTitle
              eyebrow="Request Access"
              title="Tell us who you are"
              subtitle="All fields are required, just like on the website request form."
            />
            <Input value={firstName} onChangeText={setFirstName} placeholder="First name" />
            <Input value={lastName} onChangeText={setLastName} placeholder="Last name" />
            <Input value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
            <Input value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
            <PrimaryButton busy={requestBusy} onPress={() => void handleAccessRequest()}>
              Submit Request
            </PrimaryButton>
          </Card>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  signInContent: {
    minHeight: '100%',
    justifyContent: 'flex-start',
    gap: Spacing.four,
    paddingBottom: 160,
  },
  heroWrap: {
    borderRadius: 32,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#080808',
  },
  logo: {
    width: '100%',
    height: 220,
  },
  brandTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 34,
  },
  brandCopy: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  formCard: {
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
