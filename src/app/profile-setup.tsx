import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, CheckRow, Chip, Screen, T } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { COMMON_SENSITIVITIES, SKIN_TYPES } from '@/lib/labels';
import type { Profile, SkinType } from '@/lib/types';

const BUDGETS: { value: NonNullable<Profile['budget']>; label: string }[] = [
  { value: 'low', label: 'Budget' },
  { value: 'medium', label: 'Mid-range' },
  { value: 'high', label: 'Premium' },
];

// Used for first-time setup and for editing later from Settings.
export default function ProfileSetup() {
  const c = useTheme();
  const { profile, updateProfile } = useAuth();
  const editing = Boolean(profile?.skin_type);
  const [skinType, setSkinType] = useState<SkinType | null>(profile?.skin_type ?? null);
  const [sens, setSens] = useState<string[]>(profile?.sensitivities ?? []);
  const [pregnant, setPregnant] = useState(profile?.pregnant_or_breastfeeding ?? false);
  const [budget, setBudget] = useState<Profile['budget']>(profile?.budget ?? 'medium');
  const [busy, setBusy] = useState(false);

  const toggle = (s: string) => setSens((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  async function save() {
    if (!skinType) return;
    setBusy(true);
    try {
      await updateProfile({ skin_type: skinType, sensitivities: sens, pregnant_or_breastfeeding: pregnant, budget });
      if (editing && router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button title={editing ? 'Save' : 'Continue'} onPress={save} disabled={!skinType} loading={busy} />}>
      <T variant="title">About your skin</T>
      <T muted>This helps the AI tailor its suggestions. You can change it any time.</T>

      <T variant="heading" style={{ marginTop: Spacing.sm }}>How does your skin usually feel?</T>
      <View style={{ gap: Spacing.sm }}>
        {SKIN_TYPES.map((t) => {
          const selected = skinType === t.value;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setSkinType(t.value)}
              style={{
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected ? c.accent : c.border,
                backgroundColor: selected ? c.accentSoft : c.surface,
                borderRadius: Radius.md,
                padding: Spacing.md,
              }}>
              <T variant="heading">{t.label}</T>
              <T variant="small" muted>{t.hint}</T>
            </Pressable>
          );
        })}
      </View>

      <T variant="heading" style={{ marginTop: Spacing.sm }}>Anything your skin reacts to?</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
        {COMMON_SENSITIVITIES.map((s) => (
          <Chip key={s} label={s} selected={sens.includes(s)} onPress={() => toggle(s)} />
        ))}
      </View>

      <T variant="heading" style={{ marginTop: Spacing.sm }}>Budget for products</T>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        {BUDGETS.map((b) => (
          <Chip key={b.value} label={b.label} selected={budget === b.value} onPress={() => setBudget(b.value)} />
        ))}
      </View>

      <CheckRow checked={pregnant} onToggle={() => setPregnant((v) => !v)}>
        <T variant="small">I’m pregnant or breastfeeding</T>
        <T variant="caption" muted>Some ingredients (like retinoids) aren’t recommended — we’ll leave them out.</T>
      </CheckRow>
    </Screen>
  );
}
