import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

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
 * Local charts are usable signed out. Account chart sync requires separate opt-in.
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

  const fieldStyle = {
    backgroundColor: theme.color.bgSolidCard,
    borderColor: theme.color.bdCard,
    borderWidth: theme.border.hairline,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    color: theme.color.txPrimary,
    ...theme.type.whyteSm,
  };

  const buttonStyle = (enabled: boolean) => ({
    backgroundColor: enabled ? theme.color.bgSolidButton : theme.color.bgSolidButtonDisabled,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    alignItems: 'center' as const,
  });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.bgSolidBase,
        padding: theme.space.xl,
        gap: theme.space.lg,
      }}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/chart-defaults')} style={buttonStyle(true)}>
        <Text style={{ ...theme.type.whyteSm, color: theme.color.txButton }}>Default chart settings</Text>
      </Pressable>
      {account ? (
        <>
          <View style={{ gap: theme.space.xs }}>
            <Text style={{ ...theme.type.whyteMd, color: theme.color.txPrimary }}>
              @{account.handle}
            </Text>
            <Text style={{ ...theme.type.fraktionXxs, color: theme.color.txTertiary }}>
              {account.did}
            </Text>
          </View>
          <Text style={{ ...theme.type.whyteSm, color: theme.color.txSecondary }}>
            Signing out stops chart sync and hides this account’s charts on this device. Local charts outside the account remain available.
          </Text>
          <Pressable onPress={() => router.push('/charts')} style={buttonStyle(true)}>
            <Text style={{ ...theme.type.whyteSm, color: theme.color.txButton }}>Saved charts and sync</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/chart-transfers')} style={buttonStyle(true)}>
            <Text style={{ ...theme.type.whyteSm, color: theme.color.txButton }}>Charts transferred from the old app</Text>
          </Pressable>
          {error && <Text accessibilityRole="alert" style={{ color: theme.color.txError }}>{error}</Text>}
          <Pressable onPress={() => { void signOut().catch(() => Alert.alert('Could not finish signing out', 'The saved session could not be cleared from this device. Please try again.', [{ text: 'Retry', onPress: () => { void signOut().catch(() => Alert.alert('Sign-out failed', 'Device storage is unavailable. Try again when it is available.')); } }])); }} style={buttonStyle(true)}>
            <Text style={{ ...theme.type.whyteSm, color: theme.color.txButton }}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ ...theme.type.whyteSm, color: theme.color.txSecondary }}>
            Sign in with your ATProto handle. Your permanent account identity is its DID; changing your handle keeps the same account.
          </Text>
          <TextInput
            style={fieldStyle}
            placeholder="you.bsky.social"
            placeholderTextColor={theme.color.txTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            value={handle}
            onChangeText={setHandle}
            onSubmitEditing={() => void submit()}
            editable={!busy}
          />
          {error ? (
            <Text style={{ ...theme.type.whyteXs, color: theme.color.txError }}>{error}</Text>
          ) : null}
          <Pressable onPress={() => void submit()} disabled={busy} style={buttonStyle(!busy)}>
            <Text
              style={{
                ...theme.type.whyteSm,
                color: busy ? theme.color.txDisabled : theme.color.txButton,
              }}>
              {busy ? 'Signing in…' : 'Sign in with ATProto'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
