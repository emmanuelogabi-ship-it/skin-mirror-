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
