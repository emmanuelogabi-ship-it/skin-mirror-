import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Button, Card, Screen, SeverityMeter, T } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import {
  CONCERN_LABELS,
  QUALITY_LABELS,
  REFERRAL_COPY,
  REGION_LABELS,
  SEVERITY_LABELS,
} from '@/lib/labels';
import { fetchScan, signedPhotoUrls } from '@/lib/scan';
import type { ScanWithFindings } from '@/lib/types';

export default function Result() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scan, setScan] = useState<ScanWithFindings | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const s = await fetchScan(id);
      if (!alive) return;
      setScan(s);
      setLoading(false);
      // Still running (e.g. opened from History mid-analysis)? Check again shortly.
      if (s && (s.status === 'processing' || s.status === 'uploading')) timer = setTimeout(load, 3000);
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [id]);

  useEffect(() => {
    if (scan?.image_paths.length) signedPhotoUrls(scan.image_paths).then(setUrls);
  }, [scan?.image_paths]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  if (loading || !scan) {
    return (
      <Screen footer={<Button title="Close" variant="ghost" onPress={close} />}>
        {loading ? <ActivityIndicator color={c.accent} /> : <T>We couldn’t find this scan.</T>}
      </Screen>
    );
  }

  const date = new Date(scan.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const findings = [...scan.scan_findings].sort((a, b) => b.severity - a.severity);
  const referral = scan.referral_level !== 'none' ? REFERRAL_COPY[scan.referral_level] : null;

  return (
    <Screen
      footer={
        scan.status === 'retake' || scan.status === 'error' ? (
          <>
            <Button title="Try again" onPress={() => router.replace('/scan')} />
            <Button title="Close" variant="ghost" onPress={close} />
          </>
        ) : (
          <Button title="Done" onPress={close} />
        )
      }>
      <T variant="caption" muted>{date.toUpperCase()}</T>
      <T variant="title">
        {scan.status === 'complete' ? 'Your skin today'
          : scan.status === 'retake' ? 'Let’s try that again'
          : scan.status === 'error' ? 'Something went wrong'
          : 'Analysing…'}
      </T>

      {urls.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
          {urls.map((u, i) => (
            <Image key={u} source={{ uri: u }} style={{ width: 96, height: 128, borderRadius: Radius.sm }} accessibilityLabel={`Scan photo ${i + 1}`} />
          ))}
        </ScrollView>
      ) : null}

      {scan.status === 'processing' || scan.status === 'uploading' ? (
        <Card><ActivityIndicator color={c.accent} /><T variant="small" muted>This usually takes about 20 seconds.</T></Card>
      ) : null}

      {scan.status === 'error' ? (
        <Card tone="danger"><T variant="small">The analysis didn’t finish. Your photos are safe — please try again.</T></Card>
      ) : null}

      {scan.status === 'retake' && scan.quality ? (
        <Card tone="warn">
          <T variant="heading">We couldn’t read your skin clearly</T>
          {scan.quality.issues.map((i) => <T key={i} variant="small">• {QUALITY_LABELS[i]}</T>)}
          {scan.quality.advice ? <T variant="small" muted>{scan.quality.advice}</T> : null}
        </Card>
      ) : null}

      {referral ? (
        <Card tone={scan.referral_level === 'pharmacist' ? 'warn' : 'danger'}>
          <T variant="heading">{referral.title}</T>
          <T variant="small">{referral.body}</T>
          {scan.red_flags.map((f, i) => (
            <T key={i} variant="small" muted>• {f.sign}</T>
          ))}
        </Card>
      ) : null}

      {scan.summary ? <T>{scan.summary}</T> : null}

      {findings.length ? (
        <View style={{ gap: Spacing.sm }}>
          <T variant="heading" style={{ marginTop: Spacing.sm }}>What we noticed</T>
          {findings.map((f) => (
            <Card key={f.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <T variant="heading">{CONCERN_LABELS[f.concern]}</T>
                  <T variant="small" muted>{REGION_LABELS[f.face_region]}</T>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <SeverityMeter value={f.severity} />
                  <T variant="caption" muted>{SEVERITY_LABELS[f.severity]}</T>
                </View>
              </View>
              {f.notes ? <T variant="small" muted>{f.notes}</T> : null}
            </Card>
          ))}
        </View>
      ) : scan.status === 'complete' ? (
        <Card tone="accent"><T variant="small">Nothing notable stood out in these photos. Nice work.</T></Card>
      ) : null}

      {scan.status === 'complete' ? (
        <Card tone="accent">
          <T variant="heading">Coming next: your routine</T>
          <T variant="small" muted>
            Soon Skin Mirror will turn these results into a morning and evening routine with reminders, and track
            these scores as you go.
          </T>
        </Card>
      ) : null}

      <T variant="caption" muted>
        AI-generated cosmetic guidance, not a medical diagnosis. If something is painful, spreading, bleeding or
        changing, please see a pharmacist or doctor.
      </T>
    </Screen>
  );
}
