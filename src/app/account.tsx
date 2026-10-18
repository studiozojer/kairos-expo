import { FieldSection, FieldRow, FieldNavigation, FieldText } from '@/components/fields';
import { ContextualTipsSetting } from '@/features/tips/ContextualTips';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { SignInError } from '@/auth/signIn';
import { useTheme } from '@/theme';

/**
 * Account — a modal on the root stack, not a tab. Sign-in is an occasional
 * act; it is entered from the journal home and left behind it.
 *
 * Identity is ATProto, federated through the kairos server: the server does
 * the OAuth dance, and only a session token ever touches this device (Keychain
 * via expo-secure-store). One account across Kairos and zhouyi.
 *
 * Local charts are usable signed out. Account charts download automatically; edit/upload sync is optional.
 */
export default function AccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { account, busy, signIn, signOut } = useAuth();

  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await signIn(handle);
      // Signed in — return to where the modal was opened from.
      router.back();
    } catch (e) {
      setError(e instanceof SignInError ? e.message : 'sign-in failed — please try again');
    }
  };

  const requestSignOut = () => {
    void signOut().catch(() => Alert.alert('Could not finish signing out', 'The saved session could not be cleared from this device. Please try again.', [{ text: 'Retry', onPress: () => { void signOut().catch(() => Alert.alert('Sign-out failed', 'Device storage is unavailable. Try again when it is available.')); } }]));
  };

  return <ScrollView style={{ flex: 1, backgroundColor: theme.color.bgSolidBase }} keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ padding: theme.space.lg }}>
    <FieldSection title="Chart preferences" footer="Defaults apply to new charts. Your personal star library is shared across charts and display presets.">
      <FieldNavigation label="Default chart settings" onPress={() => router.push('/chart-defaults')} />
      <FieldNavigation label="Personal star library" onPress={() => router.push('/star-library')} />
    </FieldSection>
    <FieldSection title="Help"><ContextualTipsSetting /></FieldSection>
    {account ? <>
      <FieldSection title="Account" footer="Signing out stops chart sync and hides this account’s charts on this device. Local charts outside the account remain available.">
        <FieldRow label={`@${account.handle}`} detail={account.did} />
        <FieldNavigation label="Saved charts" onPress={() => router.push('/charts')} />
        <FieldNavigation label="Chart exceptions" onPress={() => router.push('/chart-transfers')} />
        <FieldNavigation label="Sign out" destructive onPress={requestSignOut} />
      </FieldSection>
      {error && <Text accessibilityRole="alert" style={[theme.type.whyteXs, { color: theme.color.txError }]}>{error}</Text>}
    </> : <FieldSection title="Account" footer="Sign in with your ATProto handle. Your permanent account identity is its DID; changing your handle keeps the same account.">
      <FieldText label="ATProto handle" placeholder="you.bsky.social" autoCapitalize="none" autoCorrect={false}
        returnKeyType="go" value={handle} onChangeText={setHandle} onSubmitEditing={() => void submit()} disabled={busy} error={error ?? undefined} />
      <FieldNavigation label={busy ? 'Signing in…' : 'Sign in with ATProto'} disabled={busy} onPress={() => void submit()} />
    </FieldSection>}
  </ScrollView>;
}
