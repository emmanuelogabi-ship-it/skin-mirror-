// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSystemPrompt, extractToolInput, normalizeAnalysis } from './analysis.ts';

const good = {
  quality: { ok: true, issues: [], advice: '' },
  findings: [
    { concern: 'dark_spots', face_region: 'left_cheek', severity: 3, confidence: 0.8, notes: 'Two small darker patches.' },
    { concern: 'fine_lines', face_region: 'under_eyes', severity: 2, confidence: 0.6, notes: 'Light lines.' },
  ],
  red_flags: [],
  summary: 'Your skin looks healthy overall.',
};

test('keeps valid findings, sorted by severity', () => {
  const a = normalizeAnalysis(good);
  assert.equal(a.quality.ok, true);
  assert.equal(a.findings.length, 2);
  assert.equal(a.findings[0].concern, 'dark_spots');
  assert.equal(a.referral_level, 'none');
});

test('drops unknown concerns and clamps numbers', () => {
  const a = normalizeAnalysis({
    ...good,
    findings: [
      { concern: 'melanoma', face_region: 'nose', severity: 5, confidence: 1, notes: '' },
      { concern: 'redness', face_region: 'somewhere', severity: 9, confidence: 3, notes: 'x' },
      { concern: 'acne', face_region: 'chin', severity: 'lots', confidence: 0.5, notes: '' },
    ],
  });
  assert.equal(a.findings.length, 1);
  assert.deepEqual(
    { concern: a.findings[0].concern, region: a.findings[0].face_region, sev: a.findings[0].severity, conf: a.findings[0].confidence },
    { concern: 'redness', region: 'full_face', sev: 5, conf: 1 },
  );
});

test('merges duplicate concern/region keeping the higher severity', () => {
  const a = normalizeAnalysis({
    ...good,
    findings: [
      { concern: 'acne', face_region: 'chin', severity: 2, confidence: 0.9, notes: 'a' },
      { concern: 'acne', face_region: 'chin', severity: 4, confidence: 0.7, notes: 'b' },
    ],
  });
  assert.equal(a.findings.length, 1);
  assert.equal(a.findings[0].severity, 4);
});

test('bad photo quality returns no findings and a retake tip', () => {
  const a = normalizeAnalysis({ ...good, quality: { ok: false, issues: ['too_dark'], advice: '' } });
  assert.equal(a.quality.ok, false);
  assert.equal(a.findings.length, 0);
  assert.ok(a.quality.advice.length > 0);
});

test('quality.ok with issues listed is treated as not ok', () => {
  const a = normalizeAnalysis({ ...good, quality: { ok: true, issues: ['blurry'], advice: 'Hold still' } });
  assert.equal(a.quality.ok, false);
  assert.equal(a.findings.length, 0);
});

test('suspected minor: no findings, no red flags, adults-only message', () => {
  const a = normalizeAnalysis({
    ...good,
    quality: { ok: false, issues: ['appears_under_18'], advice: '' },
    red_flags: [{ sign: 'rash', reason: 'x', referral: 'gp' }],
  });
  assert.equal(a.findings.length, 0);
  assert.equal(a.red_flags.length, 0);
  assert.match(a.summary, /18/);
});

test('referral level is the most serious red flag', () => {
  const a = normalizeAnalysis({
    ...good,
    red_flags: [
      { sign: 'Localised crusting', reason: 'Could be infected', referral: 'pharmacist' },
      { sign: 'Lip swelling', reason: 'Possible allergic reaction', referral: 'urgent' },
      { sign: 'Irregular mole', reason: 'Should be checked', referral: 'bogus' },
    ],
  });
  assert.equal(a.referral_level, 'urgent');
  assert.equal(a.red_flags[2].referral, 'gp'); // unknown values default to GP, never to "none"
});

test('handles garbage input without throwing', () => {
  const a = normalizeAnalysis(null);
  assert.equal(a.quality.ok, false);
  assert.deepEqual(a.findings, []);
});

test('extractToolInput finds the tool call or throws', () => {
  const input = extractToolInput({ content: [{ type: 'text', text: 'hi' }, { type: 'tool_use', name: 'record_skin_analysis', input: good }] });
  assert.deepEqual(input, good);
  assert.throws(() => extractToolInput({ content: [{ type: 'text', text: 'no' }] }));
});

test('system prompt keeps the safety rules', () => {
  const p = buildSystemPrompt();
  for (const phrase of ['must not diagnose', 'Never name medicines', 'ALL skin tones', 'under 18']) {
    assert.ok(p.includes(phrase), `prompt should include "${phrase}"`);
  }
});
