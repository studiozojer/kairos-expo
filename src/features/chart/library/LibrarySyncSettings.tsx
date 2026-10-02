import { captureSession } from '@/auth/session';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Action, Note, Section } from '../display/controls';
import { useActiveCharts } from '../active/ActiveChartsContext';

export function LibrarySyncSettings() {
  const state = useActiveCharts();
  const router = useRouter();
  const enable = async () => {
    const captured = await captureSession();
    if (!captured || captured.account.did !== state.scope) return;
    Alert.alert('Enable chart sync?',
    state.anonymousCount
      ? `Your account charts will sync privately through Kairos. Include ${state.anonymousCount} local chart${state.anonymousCount === 1 ? '' : 's'}? Included charts become part of this account and are hidden when you sign out. Your open wheel stays on this device.`
      : 'Your account charts will sync privately through Kairos. Your open wheel stays on this device. Charts remain usable offline.',
    [{ text: 'Cancel', style: 'cancel' },
      ...(state.anonymousCount ? [{ text: 'Account charts only', onPress: () => { void state.setSyncEnabled(true, false, captured); } }] : []),
      { text: state.anonymousCount ? 'Include local charts' : 'Enable sync', onPress: () => { void state.setSyncEnabled(true, true, captured); } }]);
  };
  return <Section title="Chart sync">
    {!state.scope ? <>
      <Note>Charts are saved on this device. Sign in with ATProto to optionally sync them across devices. Signing in does not upload anything.</Note>
      <Action label="Sign in for chart sync" onPress={() => router.push('/account')} />
    </> : <>
      <Note>{state.syncState?.enabled ? 'Sync is enabled for this account. Local charts are included only with your permission.' : 'Charts save on this device. Sync is off for this account.'}</Note>
      {state.syncState?.enabled ? <>
        <Note>{state.syncing ? 'Syncing charts…' : state.syncState.pending ? `${state.syncState.pending} change${state.syncState.pending === 1 ? '' : 's'} waiting to sync.` : state.syncState.lastSyncedAt ? `Last synced ${new Date(state.syncState.lastSyncedAt).toLocaleString()}.` : 'Waiting for the first sync.'}</Note>
        <Action label="Sync now" onPress={() => void state.runSync()} />
        {state.anonymousCount > 0 && <Action label="Include local charts in sync" onPress={enable} />}
        <Action label="Pause chart sync" onPress={() => Alert.alert('Pause chart sync?', 'Your charts stay on this device and the server. Changes will wait here until you enable sync again.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Pause sync', onPress: () => { void state.setSyncEnabled(false); } },
        ])} />
      </> : <Action label="Enable chart sync" onPress={enable} />}
      <Action label="Charts transferred from the old app" onPress={() => router.push('/chart-transfers')} />
      {!!state.syncState?.conflicts && <Note>Conflicting changes were preserved. Look for charts named “(conflict copy)”. A conflicting deletion keeps the other device’s version.</Note>}
      {state.syncError && <Note>{state.syncError} Your charts remain available on this device. Sync retries while the app is open.</Note>}
    </>}
    {state.libraryError && <Note>{state.libraryError}</Note>}
  </Section>;
}
