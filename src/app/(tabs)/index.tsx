import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, CheckRow, Screen, SeverityMeter, T } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { CONCERN_LABELS, REGION_LABELS } from '@/lib/labels';
import { syncReminders } from '@/lib/notifications';
import { buildRoutine, fetchActiveRoutine, fetchRecentLogs, isStepDueToday, streakFromLogs, toggleStepLog } from '@/lib/routine';
import { fetchScans } from '@/lib/scan';
import type { Routine, RoutineStep, ScanWithFindings, StepLog } from '@/lib/types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function stepLabel(step: RoutineStep): string {
  return step.products?.name ?? step.custom_name ?? 'Step';
}

export default function Today() {
  const c = useTheme();
  const { profile, session } = useAuth();
  const [latest, setLatest] = useState<ScanWithFindings | null>(null);
  const [count, setCount] = useState(0);
  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchScans().then((scans) => {
        const done = scans.filter((s) => s.status === 'complete');
        setLatest(done[0] ?? null);
        setDaysSince(done[0] ? Math.floor((Date.now() - new Date(done[0].created_at).getTime()) / 86_400_000) : null);
        setCount(done.length);
      });
      fetchActiveRoutine().then(setRoutine);
      fetchRecentLogs().then(setLogs);
      if (profile) syncReminders(profile.am_reminder, profile.pm_reminder);
      // profile is intentionally omitted so this doesn't re-run on every profile edit — the
      // Settings screen re-syncs reminders itself when the toggles actually change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const doneToday = new Set(logs.filter((l) => l.log_date === todayKey).map((l) => l.routine_step_id));
  const streak = streakFromLogs(logs);

  const top = latest ? [...latest.scan_findings].sort((a, b) => b.severity - a.severity).slice(0, 3) : [];

  async function handleBuildRoutine() {
    setBuilding(true);
    setBuildError(null);
    try {
      await buildRoutine();
      setRoutine(await fetchActiveRoutine());
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBuilding(false);
    }
  }

  async function handleToggle(step: RoutineStep, currentlyDone: boolean) {
    if (!session) return;
    // Optimistic update so the checkbox responds instantly.
    setLogs((prev) =>
      currentlyDone
        ? prev.filter((l) => !(l.routine_step_id === step.id && l.log_date === todayKey))
        : [...prev, { id: `optimistic-${step.id}`, routine_step_id: step.id, log_date: todayKey }],
    );
    try {
      await toggleStepLog(step.id, !currentlyDone, session.user.id);
    } catch {
      fetchRecentLogs().then(setLogs); // fall back to the real state if the write failed
    }
  }

  const dueSteps = routine
    ? routine.routine_steps.filter((s) => isStepDueToday(s, routine.created_at))
    : [];
  const amSteps = dueSteps.filter((s) => s.period === 'am');
  const pmSteps = dueSteps.filter((s) => s.period === 'pm');

  return (
    <Screen edges={['top']}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <T variant="caption" muted>{greeting().toUpperCase()}{profile?.display_name ? `, ${profile.display_name.toUpperCase()}` : ''}</T>
          <T variant="display">{latest ? 'Your skin' : 'Let’s see your skin'}</T>
        </View>
        {streak.current > 0 ? (
          <View style={{ alignItems: 'center', paddingTop: Spacing.xs }}>
            <T variant="title">🔥{streak.current}</T>
            <T variant="caption" muted>day streak</T>
          </View>
        ) : null}
      </View>

      {routine ? (
        <View style={{ gap: Spacing.sm }}>
          {amSteps.length > 0 && (
            <Card>
              <T variant="heading">Morning</T>
              {amSteps.map((s) => (
                <CheckRow key={s.id} checked={doneToday.has(s.id)} onToggle={() => handleToggle(s, doneToday.has(s.id))}>
                  <T variant="small">{stepLabel(s)}</T>
                  <T variant="caption" muted>{s.instructions}</T>
                </CheckRow>
              ))}
            </Card>
          )}
          {pmSteps.length > 0 && (
            <Card>
              <T variant="heading">Evening</T>
              {pmSteps.map((s) => (
                <CheckRow key={s.id} checked={doneToday.has(s.id)} onToggle={() => handleToggle(s, doneToday.has(s.id))}>
                  <T variant="small">{stepLabel(s)}</T>
                  <T variant="caption" muted>{s.instructions}</T>
                </CheckRow>
              ))}
            </Card>
          )}
          {amSteps.length === 0 && pmSteps.length === 0 ? (
            <Card><T variant="small" muted>Nothing due today — enjoy the rest day.</T></Card>
          ) : null}
        </View>
      ) : latest ? (
        <Card tone="accent" style={{ gap: Spacing.md }}>
          <T variant="heading">Build your routine</T>
          <T variant="small" muted>We’ll turn your scan results into a simple morning and evening routine.</T>
          <Button title="Build my routine" onPress={handleBuildRoutine} loading={building} />
          {buildError ? <T variant="small" color={c.danger}>{buildError}</T> : null}
        </Card>
      ) : null}

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
