import { useState } from 'react';
import { TextInput } from 'react-native';

import { Button, Card, CheckRow, Screen, T } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

const THIS_YEAR = new Date().getFullYear();

// Explicit, separate consents — face photos are sensitive personal data under UK/EU GDPR.
export default function Consent() {
  const c = useTheme();
  const { updateProfile, signOut } = useAuth();
  const [year, setYear] = useState('');
  const [notMedical, setNotMedical] = useState(false);
  const [photos, setPhotos] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const birthYear = Number(year);
  const validYear = year.length === 4 && birthYear > 1900 && birthYear <= THIS_YEAR;
  // Conservative: someone born this year minus 18 may not have had their birthday yet.
  const tooYoung = validYear && THIS_YEAR - birthYear < 18;
  const maybeUnder = validYear && THIS_YEAR - birthYear === 18;
  const canContinue = validYear && !tooYoung && notMedical && photos && terms;

  async function accept() {
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();
    try {
      await updateProfile({
        birth_year: birthYear,
        terms_accepted_at: now,
        photo_consent_at: now,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Agree and continue" onPress={accept} disabled={!canContinue} loading={busy} />
          <Button title="Sign out" variant="ghost" onPress={signOut} />
        </>
      }>
      <T variant="title">Before we begin</T>
      <T muted>Your skin photos are personal. Here’s exactly how we treat them.</T>

      <Card>
        <T variant="heading">How your photos are used</T>
        <T variant="small" muted>
          • Stored privately and encrypted — only you can see them.{'\n'}
          • Sent to our AI provider (Anthropic’s Claude) only to analyse your skin. They are not used to train AI models.{'\n'}
          • Never sold, never shared with brands, never used to identify you.{'\n'}
          • Delete any scan, or your whole account and every photo, at any time in Settings.
        </T>
      </Card>

      <T variant="heading">Year of birth</T>
      <TextInput
        value={year}
        onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        placeholder="e.g. 1994"
        placeholderTextColor={c.textSecondary}
        accessibilityLabel="Year of birth"
        style={{
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          color: c.text,
          borderRadius: Radius.md,
          height: 52,
          paddingHorizontal: Spacing.md,
          fontSize: 17,
        }}
      />
      {tooYoung ? (
        <T variant="small" color={c.danger}>Sorry — Skin Mirror is only for adults aged 18 and over.</T>
      ) : maybeUnder ? (
        <T variant="small" muted>Please only continue if you have already turned 18.</T>
      ) : null}

      <CheckRow checked={notMedical} onToggle={() => setNotMedical((v) => !v)}>
        <T variant="small">
          I understand Skin Mirror gives cosmetic skincare guidance, not a medical diagnosis, and I’ll see a
          pharmacist or doctor for anything painful, spreading, bleeding or worrying.
        </T>
      </CheckRow>
      <CheckRow checked={photos} onToggle={() => setPhotos((v) => !v)}>
        <T variant="small">
          I give explicit consent for Skin Mirror to store and analyse photos of my face as described above.
        </T>
      </CheckRow>
      <CheckRow checked={terms} onToggle={() => setTerms((v) => !v)}>
        <T variant="small">I’m 18 or over and agree to the Terms of Service and Privacy Policy.</T>
      </CheckRow>
      {error ? <T variant="small" color={c.danger}>{error}</T> : null}
    </Screen>
  );
}
