import { computeStreak, isDueToday } from '../../supabase/functions/_shared/routine';
import { supabase } from './supabase';
import type { Routine, RoutineStep, StepLog } from './types';

export { computeStreak, isDueToday } from '../../supabase/functions/_shared/routine';

export async function fetchActiveRoutine(): Promise<Routine | null> {
  const { data } = await supabase
    .from('routines')
    .select('*, routine_steps(*, products(*))')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  // routine_steps has no natural order column guarantee from PostgREST — sort client-side.
  data.routine_steps = [...(data.routine_steps ?? [])].sort((a: RoutineStep, b: RoutineStep) => a.step_order - b.step_order);
  return data as Routine;
}

export interface BuildRoutineResponse {
  routine_id: string;
  note: string;
  step_count: number;
  error?: string;
}

export async function buildRoutine(): Promise<BuildRoutineResponse> {
  const { data, error } = await supabase.functions.invoke<BuildRoutineResponse>('build-routine', { method: 'POST' });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? 'Could not build your routine. Please try again.');
  }
  if (!data) throw new Error('Could not build your routine. Please try again.');
  return data;
}

/** Every step_log for this user within the last `days` days (for today's checklist + streak). */
export async function fetchRecentLogs(days = 90): Promise<StepLog[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from('step_logs')
    .select('id, routine_step_id, log_date')
    .gte('log_date', since);
  return (data as StepLog[]) ?? [];
}

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isStepDueToday(step: RoutineStep, routineCreatedAt: string): boolean {
  const start = new Date(routineCreatedAt);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSinceStart = Math.round((today.getTime() - start.getTime()) / 86_400_000);
  return isDueToday(step.frequency, daysSinceStart);
}

export async function toggleStepLog(stepId: string, done: boolean, userId: string): Promise<void> {
  const log_date = todayString();
  if (done) {
    const { error } = await supabase.from('step_logs').insert({ routine_step_id: stepId, log_date, user_id: userId });
    // Ignore "already logged today" races — the unique constraint just means someone tapped twice.
    if (error && !error.message.includes('duplicate')) throw error;
  } else {
    const { error } = await supabase
      .from('step_logs')
      .delete()
      .eq('routine_step_id', stepId)
      .eq('log_date', log_date);
    if (error) throw error;
  }
}

export function streakFromLogs(logs: StepLog[]): { current: number; longest: number } {
  const dates = [...new Set(logs.map((l) => l.log_date))];
  return computeStreak(dates, todayString());
}
