import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { Button, Card, Screen, SwitchRow, T } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { SKIN_TYPES } from '@/lib/labels';
import { requestNotificationPermission, syncReminders } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function Settings() {
  const c = useTheme();
  const { session, profile, signOut, updateProfile } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setReminder(period: 'am' | 'pm', enabled: boolean) {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setError('Turn on notifications for Skin Mirror in your phone Settings to get reminders.');
        return;
      }
    }
    const am = period === 'am' ? enabled : (profile?.am_reminder ?? true);
    const pm = period === 'pm' ? enabled : (profile?.pm_reminder ?? true);
    await updateProfile({ [period === 'am' ? 'am_reminder' : 'pm_reminder']: enabled });
    await syncReminders(am, pm);
  }

  async function deleteAccount() {
    const ok = await confirm(
      'Delete your account?',
      'This permanently deletes every photo, scan and result, and your login. It can’t be undone.',
    );
    if (!ok) return;
    setDeleting(true);
    setError(null);
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      setError('Could not delete your account. Please try again.');
      setDeleting(false);
      return;
    }
    await signOut();
  }

  const skinLabel = SKIN_TYPES.find((t) => t.value === profile?.skin_type)?.label ?? '—';

  return (
    <Screen edges={['top']}>
      <T variant="display">Settings</T>

      <Card>
        <T variant="small" muted>Signed in as</T>
        <T>{session?.user.email}</T>
      </Card>

      <Card>
        <T variant="heading">Your skin profile</T>
        <T variant="small" muted>
          {skinLabel}
          {profile?.sensitivities.length ? ` · Reacts to ${profile.sensitivities.join(', ')}` : ''}
        </T>
        <Button title="Edit profile" variant="secondary" onPress={() => router.push('/profile-setup')} />
      </Card>

      <Card>
        <T variant="heading">Reminders</T>
        <SwitchRow
          label="Morning routine"
          hint="8:00 AM"
          value={profile?.am_reminder ?? true}
          onChange={(v) => setReminder('am', v)}
        />
        <SwitchRow
          label="Evening routine"
          hint="9:00 PM"
          value={profile?.pm_reminder ?? true}
          onChange={(v) => setReminder('pm', v)}
        />
      </Card>

      <Card>
        <T variant="heading">Privacy</T>
        <T variant="small" muted>
          Your photos are stored privately and are only sent to our AI provider to analyse your skin. They’re never
          used to train AI or shared with brands.
        </T>
      </Card>

      <Button title="Sign out" variant="secondary" onPress={signOut} />
      <Button title="Delete account and all photos" variant="danger" onPress={deleteAccount} loading={deleting} />
      {error ? <T variant="small" color={c.danger}>{error}</T> : null}
    </Screen>
  );
}
