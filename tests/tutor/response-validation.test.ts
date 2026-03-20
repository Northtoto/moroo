// ─── Response Validation Tests ───────────────────────────────────────────────
// Tests for parseCorrectionResult logic: JSON extraction, markdown stripping,
// default values, confidence clamping, and pronunciation tip injection.

import { describe, it, expect } from 'vitest';
import {
  parseCorrectionResult,
  validateCorrectionResultShape,
} from './helpers';

// ─── Valid JSON Parsing ──────────────────────────────────────────────────────

describe('parseCorrectionResult - Valid JSON', () => {
  it('should parse valid JSON with all fields', () => {
    const json = JSON.stringify({
      original: 'Ich gehe zu Schule',
      corrected: 'Ich gehe zur Schule.',
      error_type: 'Präposition falsch',
      error_category: 'Präposition',
      confidence: 0.92,
      explanation_de: 'Man sagt "zur Schule" (zu + der = zur).',
      cefr_estimate: 'A2',
      new_vocabulary: [
        { word: 'Schule', translation: 'school', cefr: 'A1' },
      ],
    });

    const result = parseCorrectionResult(json, 'fallback');

    expect(result.original).toBe('Ich gehe zu Schule');
    expect(result.corrected).toBe('Ich gehe zur Schule.');
    expect(result.error_type).toBe('Präposition falsch');
    expect(result.error_categories).toEqual(['Präposition']);
    expect(result.confidence).toBe(0.92);
    expect(result.explanation_de).toContain('zur Schule');
    expect(result.cefr_estimate).toBe('A2');
    expect(result.new_vocabulary).toHaveLength(1);
    expect(result.new_vocabulary![0].word).toBe('Schule');
  });

  it('should produce a structurally valid CorrectionResult', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: 'Rechtschreibung',
      error_category: 'Rechtschreibung',
      confidence: 0.8,
      explanation_de: 'Satzanfang großschreiben.',
      cefr_estimate: 'A1',
      new_vocabulary: [],
    });

    const result = parseCorrectionResult(json, 'test');
    const validation = validateCorrectionResultShape(result);
    expect(validation.valid).toBe(true);
  });
});

// ─── Markdown Code Fence Stripping ───────────────────────────────────────────

describe('parseCorrectionResult - Markdown Code Fences', () => {
  it('should strip ```json ... ``` fences and parse', () => {
    const wrapped = '```json\n{"original":"test","corrected":"Test.","error_type":null,"error_category":null,"confidence":1.0,"explanation_de":"Perfekt!","cefr_estimate":"B1","new_vocabulary":[]}\n```';

    const result = parseCorrectionResult(wrapped, 'test');

    expect(result.original).toBe('test');
    expect(result.corrected).toBe('Test.');
    expect(result.error_type).toBeNull();
    expect(result.confidence).toBe(1.0);
  });

  it('should strip ``` fences without json tag', () => {
    const wrapped = '```\n{"original":"Hallo","corrected":"Hallo!","error_type":null,"error_category":null,"confidence":1.0,"explanation_de":"Gut!","cefr_estimate":"A1","new_vocabulary":[]}\n```';

    const result = parseCorrectionResult(wrapped, 'Hallo');
    expect(result.original).toBe('Hallo');
  });

  it('should handle JSON with surrounding prose text', () => {
    const withProse = 'Here is the correction:\n{"original":"test input","corrected":"Test Input.","error_type":"Rechtschreibung","error_category":"Rechtschreibung","confidence":0.9,"explanation_de":"Großschreibung.","cefr_estimate":"A1","new_vocabulary":[]}\nThat is all.';

    const result = parseCorrectionResult(withProse, 'test input');
    expect(result.original).toBe('test input');
    expect(result.corrected).toBe('Test Input.');
  });

  it('should handle mixed markdown and prose', () => {
    const mixed = 'Sure! ```json\n{"original":"abc","corrected":"Abc.","error_type":null,"error_category":null,"confidence":1.0,"explanation_de":"OK","cefr_estimate":"B1","new_vocabulary":[]}\n``` Hope this helps!';

    const result = parseCorrectionResult(mixed, 'abc');
    expect(result.original).toBe('abc');
    expect(result.confidence).toBe(1.0);
  });
});

// ─── Missing Required Fields / Defaults ──────────────────────────────────────

describe('parseCorrectionResult - Missing Fields and Defaults', () => {
  it('should use fallbackOriginal when original is missing', () => {
    const json = JSON.stringify({
      corrected: 'Korrigiert.',
      error_type: null,
      error_category: null,
      confidence: 1.0,
      cefr_estimate: 'B1',
    });

    const result = parseCorrectionResult(json, 'my fallback text');
    expect(result.original).toBe('my fallback text');
  });

  it('should use fallbackOriginal when corrected is missing', () => {
    const json = JSON.stringify({
      original: 'test',
      error_type: null,
      error_category: null,
      confidence: 1.0,
      cefr_estimate: 'B1',
    });

    const result = parseCorrectionResult(json, 'fallback');
    // corrected falls back to fallbackOriginal when empty/missing
    expect(result.corrected).toBe('fallback'); // corrected missing from JSON → falls back to fallbackOriginal
  });

  it('should default confidence to 0.85 when missing', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: null,
      error_category: null,
      cefr_estimate: 'B1',
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.confidence).toBe(0.85);
  });

  it('should default cefr_estimate to B1 when missing', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: null,
      error_category: null,
      confidence: 0.9,
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.cefr_estimate).toBe('B1');
  });

  it('should default new_vocabulary to empty array when missing', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: null,
      error_category: null,
      confidence: 0.9,
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.new_vocabulary).toEqual([]);
  });

  it('should default explanation_de to empty string when missing', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: null,
      error_category: null,
      confidence: 0.9,
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.explanation_de).toBe('');
  });

  it('should use "Sonstiges" as error_category fallback when error_type is present but category is missing', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: 'Some error',
      confidence: 0.8,
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.error_categories).toEqual(['Sonstiges']);
  });

  it('should produce empty error_categories when error_type is null', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: null,
      error_category: 'Rechtschreibung',
      confidence: 1.0,
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.error_categories).toEqual([]);
  });
});

// ─── Invalid JSON Handling ───────────────────────────────────────────────────

describe('parseCorrectionResult - Invalid JSON', () => {
  it('should throw on completely invalid text (no JSON at all)', () => {
    expect(() => {
      parseCorrectionResult('This is not JSON at all, just plain text.', 'fallback');
    }).toThrow('No JSON found in response');
  });

  it('should throw on malformed JSON object', () => {
    const malformed = '{"original": "test", "corrected": }';
    expect(() => {
      parseCorrectionResult(malformed, 'fallback');
    }).toThrow('INVALID_JSON_RESPONSE');
  });

  it('should throw on empty string', () => {
    expect(() => {
      parseCorrectionResult('', 'fallback');
    }).toThrow('No JSON found in response');
  });

  it('should throw on JSON array instead of object', () => {
    // The regex matches {}, so [1,2,3] won't match
    expect(() => {
      parseCorrectionResult('[1, 2, 3]', 'fallback');
    }).toThrow('No JSON found in response');
  });
});

// ─── Confidence Clamping ─────────────────────────────────────────────────────

describe('parseCorrectionResult - Confidence Clamping', () => {
  it('should clamp confidence > 1.0 to 1.0', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: null,
      error_category: null,
      confidence: 1.5,
      cefr_estimate: 'B1',
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.confidence).toBe(1.0);
  });

  it('should clamp confidence < 0.0 to 0.0', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: null,
      error_category: null,
      confidence: -0.5,
      cefr_estimate: 'B1',
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.confidence).toBe(0);
  });

  it('should keep confidence at exact boundary 0.0', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: null,
      error_category: null,
      confidence: 0.0,
      cefr_estimate: 'B1',
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.confidence).toBe(0);
  });

  it('should keep confidence at exact boundary 1.0', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: null,
      error_category: null,
      confidence: 1.0,
      cefr_estimate: 'B1',
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.confidence).toBe(1.0);
  });

  it('should clamp extremely large confidence value', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: null,
      error_category: null,
      confidence: 999,
      cefr_estimate: 'B1',
    });

    const result = parseCorrectionResult(json, 'test');
    expect(result.confidence).toBe(1.0);
  });
});

// ─── Audio Pronunciation Tip Injection ───────────────────────────────────────

describe('parseCorrectionResult - Audio Pronunciation Tip', () => {
  it('should add pronunciation tip when isAudio=true and confidence < 0.7', () => {
    const json = JSON.stringify({
      original: 'Ich abe einen Hund',
      corrected: 'Ich habe einen Hund.',
      error_type: 'Verb-Konjugation',
      error_category: 'Konjugation',
      confidence: 0.5,
      explanation_de: 'Es heißt "habe" nicht "abe".',
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(json, 'Ich abe einen Hund', true);

    expect(result.explanation_de).toContain('Aussprache-Tipp');
    expect(result.explanation_de).toContain('Es heißt "habe"');
  });

  it('should NOT add pronunciation tip when isAudio=true and confidence >= 0.7', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: 'Rechtschreibung',
      error_category: 'Rechtschreibung',
      confidence: 0.7,
      explanation_de: 'Großschreibung am Satzanfang.',
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(json, 'test', true);
    expect(result.explanation_de).not.toContain('Aussprache-Tipp');
  });

  it('should NOT add pronunciation tip when isAudio=false regardless of confidence', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: 'Rechtschreibung',
      error_category: 'Rechtschreibung',
      confidence: 0.3,
      explanation_de: 'Korrektur.',
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(json, 'test', false);
    expect(result.explanation_de).not.toContain('Aussprache-Tipp');
  });

  it('should add pronunciation tip at exactly confidence=0.69', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: 'error',
      error_category: 'cat',
      confidence: 0.69,
      explanation_de: 'Base explanation.',
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(json, 'test', true);
    expect(result.explanation_de).toContain('Aussprache-Tipp');
  });

  it('should NOT add pronunciation tip at exactly confidence=0.7', () => {
    const json = JSON.stringify({
      original: 'test',
      corrected: 'Test.',
      error_type: 'error',
      error_category: 'cat',
      confidence: 0.7,
      explanation_de: 'Base.',
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(json, 'test', true);
    expect(result.explanation_de).not.toContain('Aussprache-Tipp');
  });
});

// ─── CorrectionResult Shape Validator ────────────────────────────────────────

describe('validateCorrectionResultShape', () => {
  it('should accept a fully valid CorrectionResult', () => {
    const result = {
      original: 'test',
      corrected: 'Test.',
      error_categories: ['Rechtschreibung'],
      error_type: 'Rechtschreibung',
      confidence: 0.9,
      explanation_de: 'Explanation.',
      cefr_estimate: 'A1',
      new_vocabulary: [{ word: 'Test', translation: 'test', cefr: 'A1' }],
    };

    const validation = validateCorrectionResultShape(result);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject non-object input', () => {
    const validation = validateCorrectionResultShape('not an object');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Result is not an object');
  });

  it('should reject null input', () => {
    const validation = validateCorrectionResultShape(null);
    expect(validation.valid).toBe(false);
  });

  it('should report missing required fields', () => {
    const validation = validateCorrectionResultShape({});
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.some(e => e.includes('original'))).toBe(true);
    expect(validation.errors.some(e => e.includes('corrected'))).toBe(true);
    expect(validation.errors.some(e => e.includes('error_categories'))).toBe(true);
    expect(validation.errors.some(e => e.includes('cefr_estimate'))).toBe(true);
  });

  it('should reject confidence out of [0,1] range', () => {
    const result = {
      original: 'test',
      corrected: 'Test.',
      error_categories: [],
      cefr_estimate: 'A1',
      confidence: 1.5,
    };

    const validation = validateCorrectionResultShape(result);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('confidence'))).toBe(true);
  });

  it('should reject invalid CEFR level', () => {
    const result = {
      original: 'test',
      corrected: 'Test.',
      error_categories: [],
      cefr_estimate: 'X9',
    };

    const validation = validateCorrectionResultShape(result);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('CEFR'))).toBe(true);
  });

  it('should validate new_vocabulary item shapes', () => {
    const result = {
      original: 'test',
      corrected: 'Test.',
      error_categories: [],
      cefr_estimate: 'A1',
      new_vocabulary: [{ word: 123, translation: 'test', cefr: 'A1' }],
    };

    const validation = validateCorrectionResultShape(result);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('new_vocabulary[0].word'))).toBe(true);
  });
});
