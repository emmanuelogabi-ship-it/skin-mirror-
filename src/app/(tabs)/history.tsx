import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Screen, T } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { CONCERN_LABELS } from '@/lib/labels';
import { fetchScans } from '@/lib/scan';
import type { ScanWithFindings } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  complete: '', retake: 'Needs a retake', error: 'Didn’t finish', processing: 'Analysing…', uploading: 'Incomplete',
};

export default function History() {
  const c = useTheme();
  const [scans, setScans] = useState<ScanWithFindings[] | null>(null);

  useFocusEffect(useCallback(() => { fetchScans().then(setScans); }, []));

  return (
    <Screen edges={['top']}>
      <T variant="display">History</T>
      {scans && scans.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: Spacing.xxl, gap: Spacing.sm }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: Radius.lg,
              backgroundColor: c.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="images-outline" size={32} color={c.accent} />
          </View>
          <T variant="heading" style={{ textAlign: 'center' }}>No scans yet</T>
          <T variant="small" muted style={{ textAlign: 'center', maxWidth: 260 }}>
            Once you take a scan, it’ll show up here so you can track how your skin changes over time.
          </T>
          <Button title="Start a scan" onPress={() => router.push('/scan')} style={{ marginTop: Spacing.sm }} />
        </View>
      ) : null}
      {scans?.map((s) => {
        const top = [...s.scan_findings].sort((a, b) => b.severity - a.severity).slice(0, 3);
        return (
          <Pressable key={s.id} onPress={() => router.push({ pathname: '/result/[id]', params: { id: s.id } })} accessibilityRole="button">
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T variant="heading">
                  {new Date(s.created_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                </T>
                {s.referral_level !== 'none' ? <T variant="small" color={c.danger}>See advice</T> : null}
              </View>
              <T variant="small" muted>
                {STATUS_LABEL[s.status] || (top.length ? top.map((f) => CONCERN_LABELS[f.concern]).join(' · ') : 'Nothing notable')}
              </T>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
