import { describe, it, expect } from 'vitest';
import { parseCorrectionResult } from '../correction-parser';

const validBase = {
  original: 'Ich gehe zu schule',
  corrected: 'Ich gehe zur Schule',
  error_type: 'Grammatikfehler',
  error_category: 'Dativ',
  confidence: 0.95,
  explanation_de: 'Fehler erklärt.',
  cefr_estimate: 'A2',
  new_vocabulary: [],
};

describe('parseCorrectionResult', () => {
  it('parses clean JSON from GPT', () => {
    const result = parseCorrectionResult(JSON.stringify(validBase), 'Ich gehe zu schule', false);
    expect(result.corrected).toBe('Ich gehe zur Schule');
    expect(result.confidence).toBe(0.95);
  });

  it('strips markdown code fences before parsing', () => {
    const raw = '```json\n' + JSON.stringify(validBase) + '\n```';
    const result = parseCorrectionResult(raw, 'test', false);
    expect(result.corrected).toBe('Ich gehe zur Schule');
  });

  it('clamps confidence above 1 to 1', () => {
    const raw = JSON.stringify({ ...validBase, confidence: 1.8 });
    const result = parseCorrectionResult(raw, 'test', false);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('clamps confidence below 0 to 0', () => {
    const raw = JSON.stringify({ ...validBase, confidence: -0.5 });
    const result = parseCorrectionResult(raw, 'test', false);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('throws GPT_FAILED on garbage input (no JSON structure)', () => {
    expect(() => parseCorrectionResult('not json at all !!!', 'test', false))
      .toThrow('GPT_FAILED');
  });
});
