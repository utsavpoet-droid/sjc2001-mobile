import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricInfo = {
  available: boolean;
  label: string;
};

export async function getBiometricInfo(): Promise<BiometricInfo> {
  const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  if (!hasHardware || !isEnrolled) {
    return { available: false, label: 'Biometric unlock' };
  }

  const hasFaceId = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

  if (Platform.OS === 'ios' && hasFaceId) {
    return { available: true, label: 'Face ID' };
  }
  if (Platform.OS === 'ios' && hasFingerprint) {
    return { available: true, label: 'Touch ID' };
  }
  if (hasFingerprint) {
    return { available: true, label: 'Fingerprint unlock' };
  }

  return { available: true, label: 'Biometric unlock' };
}

export async function promptBiometric(label?: string) {
  const info = await getBiometricInfo();
  if (!info.available) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: label ? `Unlock with ${label}` : `Unlock with ${info.label}`,
    cancelLabel: 'Use password',
    fallbackLabel: 'Use passcode',
  });

  return result.success;
}
