import type {
  Concern,
  Finding,
  QualityIssue,
  RedFlag,
  ReferralLevel,
  Region,
} from '../../supabase/functions/_shared/analysis';

export type { Concern, Finding, QualityIssue, RedFlag, ReferralLevel, Region };

export type SkinType = 'dry' | 'oily' | 'combination' | 'normal' | 'sensitive' | 'unsure';

export interface Profile {
  id: string;
  display_name: string | null;
  birth_year: number | null;
  skin_type: SkinType | null;
  sensitivities: string[];
  pregnant_or_breastfeeding: boolean;
  budget: 'low' | 'medium' | 'high' | null;
  timezone: string | null;
  terms_accepted_at: string | null;
  photo_consent_at: string | null;
  am_reminder: boolean;
  pm_reminder: boolean;
}

export type ScanStatus = 'uploading' | 'processing' | 'complete' | 'retake' | 'error';

export interface Scan {
  id: string;
  created_at: string;
  status: ScanStatus;
  image_paths: string[];
  quality: { ok: boolean; issues: QualityIssue[]; advice: string } | null;
  summary: string | null;
  red_flags: RedFlag[];
  referral_level: ReferralLevel;
}

export interface ScanWithFindings extends Scan {
  scan_findings: (Finding & { id: string })[];
}

export type Period = 'am' | 'pm';
export type Frequency = 'daily' | 'every_other_day' | '3x_week' | '2x_week';
export type ProductCategory = 'cleanser' | 'toner' | 'serum' | 'treatment' | 'moisturizer' | 'spf' | 'eye_cream';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  key_ingredients: string[];
  how_to_use: string;
  affiliate_url: string | null;
}

export interface RoutineStep {
  id: string;
  routine_id: string;
  period: Period;
  step_order: number;
  product_id: string | null;
  custom_name: string | null;
  instructions: string;
  frequency: Frequency;
  wait_minutes: number;
  products: Product | null;
}

export interface Routine {
  id: string;
  created_at: string;
  active: boolean;
  routine_steps: RoutineStep[];
}

export interface StepLog {
  id: string;
  routine_step_id: string;
  log_date: string;
}
