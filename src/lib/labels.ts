import type { Concern, QualityIssue, ReferralLevel, Region } from './types';

export const CONCERN_LABELS: Record<Concern, string> = {
  acne: 'Breakouts',
  blackheads: 'Blackheads',
  enlarged_pores: 'Visible pores',
  dark_spots: 'Dark spots',
  uneven_tone: 'Uneven tone',
  redness: 'Redness',
  dryness: 'Dryness',
  oiliness: 'Oiliness',
  fine_lines: 'Fine lines',
  wrinkles: 'Wrinkles',
  dark_circles: 'Dark circles',
  puffiness: 'Puffiness',
  texture: 'Uneven texture',
  dullness: 'Dullness',
  scarring: 'Marks & scarring',
};

export const REGION_LABELS: Record<Region, string> = {
  forehead: 'Forehead',
  between_brows: 'Between brows',
  under_eyes: 'Under eyes',
  nose: 'Nose',
  left_cheek: 'Left cheek',
  right_cheek: 'Right cheek',
  upper_lip: 'Upper lip',
  chin: 'Chin',
  jawline: 'Jawline',
  full_face: 'Whole face',
};

export const SEVERITY_LABELS = ['', 'Barely visible', 'Mild', 'Moderate', 'Marked', 'Pronounced'];

export const QUALITY_LABELS: Record<QualityIssue, string> = {
  too_dark: 'Too dark',
  too_bright: 'Too bright or washed out',
  blurry: 'Blurry',
  face_not_visible: 'Face not fully visible',
  face_obstructed: 'Face partly covered',
  heavy_makeup_or_filter: 'Make-up or filter hides the skin',
  multiple_people: 'More than one person',
  not_a_face: 'No face found',
  appears_under_18: 'For adults 18+ only',
};

export const REFERRAL_COPY: Record<Exclude<ReferralLevel, 'none'>, { title: string; body: string }> = {
  pharmacist: {
    title: 'Worth asking a pharmacist',
    body: 'We noticed something a pharmacist should look at before you add new products. They can advise you in person, usually without an appointment.',
  },
  gp: {
    title: 'Please see a doctor',
    body: 'We noticed something that should be checked by a GP or dermatologist. Skincare isn’t the right fix for this, so we haven’t suggested products for it.',
  },
  urgent: {
    title: 'Get medical help now',
    body: 'Sudden swelling, hives or open wounds can be serious. Call your local emergency number or NHS 111 (UK) / 911 (US) / 112 (EU) if you have trouble breathing or swallowing.',
  },
};

export const SKIN_TYPES = [
  { value: 'dry', label: 'Dry', hint: 'Feels tight, can flake' },
  { value: 'oily', label: 'Oily', hint: 'Shiny by midday' },
  { value: 'combination', label: 'Combination', hint: 'Oily T-zone, drier cheeks' },
  { value: 'normal', label: 'Normal', hint: 'Mostly comfortable' },
  { value: 'sensitive', label: 'Sensitive', hint: 'Reacts, stings or flushes easily' },
  { value: 'unsure', label: 'Not sure', hint: 'We’ll learn from your scans' },
] as const;

export const COMMON_SENSITIVITIES = [
  'Fragrance', 'Essential oils', 'Alcohol', 'Retinoids', 'AHA/BHA acids',
  'Vitamin C', 'Benzoyl peroxide', 'Nuts', 'Lanolin',
];
