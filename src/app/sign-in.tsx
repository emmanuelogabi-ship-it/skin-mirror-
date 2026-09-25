import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Button, Screen, T } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Passwordless sign-in: we email a 6-digit code.
export default function SignIn() {
  const c = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = [styles.input, { borderColor: c.border, backgroundColor: c.surface, color: c.text }];

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    // On success the auth listener updates the session and the navigator moves on.
    if (error) setError(error.message);
  }

  return (
    <Screen
      footer={
        sent ? (
          <>
            <Button title="Continue" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
            <Button title="Use a different email" variant="ghost" onPress={() => { setSent(false); setCode(''); }} />
          </>
        ) : (
          <>
            <Button title="Email me a code" onPress={sendCode} loading={busy} disabled={!EMAIL_RE.test(email.trim())} />
            <Button title="Back" variant="ghost" onPress={() => router.back()} />
          </>
        )
      }>
      <T variant="title">{sent ? 'Check your email' : 'Sign in or create an account'}</T>
      <T muted>
        {sent
          ? `We sent a code to ${email.trim()}. Enter it below.`
          : 'No password needed — we’ll email you a one-time code.'}
      </T>
      {sent ? (
        <TextInput
          style={[input, styles.code]}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          placeholder="123456"
          placeholderTextColor={c.textSecondary}
          autoFocus
          accessibilityLabel="One-time code"
        />
      ) : (
        <TextInput
          style={input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
          placeholderTextColor={c.textSecondary}
          autoFocus
          accessibilityLabel="Email address"
        />
      )}
      {error ? <T variant="small" color={c.danger}>{error}</T> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 52, fontSize: 17 },
  code: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
});
