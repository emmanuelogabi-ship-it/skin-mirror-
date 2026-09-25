import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Screen, SeverityMeter, T } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { CONCERN_LABELS, REGION_LABELS } from '@/lib/labels';
import { fetchScans } from '@/lib/scan';
import type { ScanWithFindings } from '@/lib/types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const c = useTheme();
  const { profile } = useAuth();
  const [latest, setLatest] = useState<ScanWithFindings | null>(null);
  const [count, setCount] = useState(0);
  const [daysSince, setDaysSince] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchScans().then((scans) => {
        const done = scans.filter((s) => s.status === 'complete');
        setLatest(done[0] ?? null);
        setDaysSince(done[0] ? Math.floor((Date.now() - new Date(done[0].created_at).getTime()) / 86_400_000) : null);
        setCount(done.length);
      });
    }, []),
  );

  const top = latest ? [...latest.scan_findings].sort((a, b) => b.severity - a.severity).slice(0, 3) : [];

  return (
    <Screen edges={['top']}>
      <T variant="caption" muted>{greeting().toUpperCase()}{profile?.display_name ? `, ${profile.display_name.toUpperCase()}` : ''}</T>
      <T variant="display">{latest ? 'Your skin' : 'Let’s see your skin'}</T>

      <Card tone="accent" style={{ gap: Spacing.md }}>
        <T variant="heading">{latest ? ((daysSince ?? 0) >= 7 ? 'Time for your weekly scan' : 'Scan again anytime') : 'Take your first scan'}</T>
        <T variant="small" muted>
          {latest
            ? 'A scan a week, in the same light, shows your progress most clearly.'
            : 'Three quick photos in good light. Takes about a minute.'}
        </T>
        <Button title="Start a scan" onPress={() => router.push('/scan')} />
      </Card>

      {latest ? (
        <Pressable onPress={() => router.push({ pathname: '/result/[id]', params: { id: latest.id } })} accessibilityRole="button">
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T variant="heading">Latest results</T>
              <T variant="small" muted>
                {daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince} days ago`}
              </T>
            </View>
            {top.length ? top.map((f) => (
              <View key={f.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                <T variant="small">{CONCERN_LABELS[f.concern]} · <T variant="small" muted>{REGION_LABELS[f.face_region]}</T></T>
                <SeverityMeter value={f.severity} />
              </View>
            )) : <T variant="small" muted>Nothing notable stood out.</T>}
            <T variant="small" color={c.accent}>See full results →</T>
          </Card>
        </Pressable>
      ) : null}

      {count > 0 ? (
        <T variant="small" muted>{count} {count === 1 ? 'scan' : 'scans'} so far. Keep going — progress shows over weeks, not days.</T>
      ) : null}
    </Screen>
  );
}
