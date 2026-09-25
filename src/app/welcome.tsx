import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, T } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';

const POINTS = [
  { title: 'Scan', body: 'Three quick photos. Our AI maps what’s visible — spots, tone, texture, lines.' },
  { title: 'Understand', body: 'Plain-English results, rated on a simple 1–5 scale you can track.' },
  { title: 'Improve', body: 'A routine that fits your skin, and progress you can actually see.' },
];

export default function Welcome() {
  const c = useTheme();
  return (
    <Screen
      footer={
        <>
          <Button title="Get started" onPress={() => router.push('/sign-in')} />
          <T variant="caption" muted style={{ textAlign: 'center' }}>
            For adults 18+. Skin Mirror gives cosmetic skincare guidance, not medical advice.
          </T>
        </>
      }>
      <View style={{ height: Spacing.xl }} />
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: Radius.lg,
          backgroundColor: c.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View style={{ width: 34, height: 44, borderRadius: 20, borderWidth: 2.5, borderColor: c.accent }} />
      </View>
      <T variant="display">Skin Mirror</T>
      <T variant="body" muted>See your skin clearly. Care for it consistently.</T>
      <View style={{ height: Spacing.md }} />
      {POINTS.map((p, i) => (
        <View key={p.title} style={{ flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.sm }}>
          <T variant="heading" color={c.accent} style={{ width: 20 }}>{i + 1}</T>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="heading">{p.title}</T>
            <T variant="small" muted>{p.body}</T>
          </View>
        </View>
      ))}
    </Screen>
  );
}
