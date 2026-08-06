import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

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
 * Nothing is gated on sign-in yet — the journal is usable signed out. This
 * screen is identity plumbing made visible: what it unlocks arrives with the
 * Stage 3 sync conversation.
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
            Sign-out clears the session on this device. Your record is never touched.
          </Text>
          <Pressable onPress={() => void signOut()} style={buttonStyle(true)}>
            <Text style={{ ...theme.type.whyteSm, color: theme.color.txButton }}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ ...theme.type.whyteSm, color: theme.color.txSecondary }}>
            Your ATProto handle is your Kairos identity — one account across the ecosystem.
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
