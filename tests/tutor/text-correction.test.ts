// ─── Text Correction Tests ───────────────────────────────────────────────────
// Tests for the text-correction workflow: validation, GPT response parsing,
// error classification, and response shape.

import { describe, it, expect } from 'vitest';
import {
  validateTextInput,
  parseCorrectionResult,
  validateCorrectionResultShape,
  buildMockGPTResponse,
  classifyError,
  type CorrectionResult,
} from './helpers';

// ─── Text Input Validation ───────────────────────────────────────────────────

describe('Text Input Validation', () => {
  it('should accept a valid German sentence with errors', () => {
    const result = validateTextInput('Ich gehe zu schule');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept a correct German sentence', () => {
    const result = validateTextInput('Das Buch ist gut');
    expect(result.valid).toBe(true);
  });

  it('should reject empty text with 400-style error', () => {
    const result = validateTextInput('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Bitte geben Sie einen Text ein.');
  });

  it('should reject whitespace-only text', () => {
    const result = validateTextInput('   \n\t  ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Bitte geben Sie einen Text ein.');
  });

  it('should reject text with fewer than 3 words', () => {
    const result = validateTextInput('Hallo Welt');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Der Text sollte mindestens 3 Wörter enthalten.');
  });

  it('should reject single word input', () => {
    const result = validateTextInput('Hallo');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('mindestens 3 Wörter');
  });

  it('should reject text with no Latin characters', () => {
    const result = validateTextInput('これは テスト テスト テスト');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Der Text sollte lateinische Zeichen enthalten.');
  });

  it('should accept text with exactly 3 words', () => {
    const result = validateTextInput('Ich bin hier');
    expect(result.valid).toBe(true);
  });

  it('should handle very long text (2000+ chars) without crashing', () => {
    const longText = 'Ich gehe jeden Tag in die Schule und lerne Deutsch. '.repeat(50);
    expect(longText.length).toBeGreaterThan(2000);
    const result = validateTextInput(longText);
    expect(result.valid).toBe(true);
  });

  it('should accept mixed German-English text', () => {
    const result = validateTextInput('Ich habe ein meeting today');
    expect(result.valid).toBe(true);
  });
});

// ─── GPT Response Parsing for Text Correction ───────────────────────────────

describe('Text Correction - GPT Response Parsing', () => {
  it('should parse correction for "Ich gehe zu schule"', () => {
    const gptResponse = buildMockGPTResponse({
      original: 'Ich gehe zu schule',
      corrected: 'Ich gehe zur Schule.',
      error_type: 'Präposition falsch',
      confidence: 0.92,
      explanation_de: '"zu" + "der Schule" verschmilzt zu "zur". Außerdem wird "Schule" großgeschrieben.',
      cefr_estimate: 'A2',
    });

    const result = parseCorrectionResult(gptResponse, 'Ich gehe zu schule', false);

    expect(result.original).toBe('Ich gehe zu schule');
    expect(result.corrected).toBe('Ich gehe zur Schule.');
    expect(result.error_type).toBe('Präposition falsch');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.explanation_de).toBeTruthy();
    expect(result.explanation_de).toContain('zur');
  });

  it('should parse correction for verb/preposition errors in "Ich habe zu der Schule gegangen"', () => {
    const gptResponse = buildMockGPTResponse({
      original: 'Ich habe zu der Schule gegangen',
      corrected: 'Ich bin zur Schule gegangen.',
      error_type: 'Verb-Konjugation',
      confidence: 0.95,
      explanation_de: 'Mit Bewegungsverben wie "gehen" verwendet man "sein" statt "haben".',
      cefr_estimate: 'A2',
      error_categories: ['Konjugation'],
    });

    const result = parseCorrectionResult(gptResponse, 'Ich habe zu der Schule gegangen', false);

    expect(result.corrected).toContain('bin');
    expect(result.error_type).toBeTruthy();
    // The error_type should mention verb or conjugation issues
    expect(
      result.error_type!.toLowerCase().includes('verb') ||
      result.error_type!.toLowerCase().includes('konjugation')
    ).toBe(true);
  });

  it('should handle correct sentence with no errors', () => {
    const gptResponse = buildMockGPTResponse({
      original: 'Das Buch ist gut',
      corrected: 'Das Buch ist gut.',
      error_type: null,
      confidence: 1.0,
      explanation_de: 'Perfekt! Dein Satz ist grammatisch korrekt.',
      cefr_estimate: 'A1',
      error_categories: [],
    });

    const result = parseCorrectionResult(gptResponse, 'Das Buch ist gut', false);

    expect(result.error_type).toBeNull();
    expect(result.confidence).toBe(1.0);
    expect(result.error_categories).toHaveLength(0);
  });

  it('should produce a valid CorrectionResult shape', () => {
    const gptResponse = buildMockGPTResponse();
    const result = parseCorrectionResult(gptResponse, 'test input', false);

    const validation = validateCorrectionResultShape(result);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should include all required fields in response', () => {
    const gptResponse = buildMockGPTResponse();
    const result = parseCorrectionResult(gptResponse, 'test', false);

    expect(result).toHaveProperty('original');
    expect(result).toHaveProperty('corrected');
    expect(result).toHaveProperty('error_categories');
    expect(result).toHaveProperty('cefr_estimate');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('explanation_de');
  });

  it('should handle very long corrected text', () => {
    const longText = 'Ich gehe jeden Tag in die Schule. '.repeat(100);
    const gptResponse = buildMockGPTResponse({
      original: longText,
      corrected: longText,
      error_type: null,
      confidence: 1.0,
    });

    const result = parseCorrectionResult(gptResponse, longText, false);
    expect(result.original).toBe(longText);
    expect(result.corrected).toBe(longText);
  });
});

// ─── Error Classification ────────────────────────────────────────────────────

describe('Text Correction - Error Classification', () => {
  it('should classify GPT failures correctly', () => {
    const error = new Error('GPT_FAILED');
    const classified = classifyError(error, 'gpt');

    expect(classified.code).toBe('GPT_FAILED');
    expect(classified.userMessage).toContain('Korrektur fehlgeschlagen');
    expect(classified.logContext.source).toBe('gpt');
  });

  it('should classify validation errors correctly', () => {
    const error = new Error('Bitte geben Sie einen Text ein.');
    const classified = classifyError(error, 'validation');

    expect(classified.code).toBe('VALIDATION_ERROR');
    expect(classified.userMessage).toBe('Bitte geben Sie einen Text ein.');
  });

  it('should classify rate limit errors', () => {
    const error = new Error('HTTP 429: rate limit exceeded');
    const classified = classifyError(error, 'gpt');

    expect(classified.code).toBe('RATE_LIMIT');
    expect(classified.logContext.statusCode).toBe(429);
  });

  it('should classify auth errors (401)', () => {
    const error = new Error('HTTP 401: Unauthorized');
    const classified = classifyError(error, 'gpt');

    expect(classified.code).toBe('AUTH_ERROR');
    expect(classified.logContext.statusCode).toBe(401);
  });

  it('should classify service errors (503)', () => {
    const error = new Error('HTTP 503: Service Unavailable');
    const classified = classifyError(error, 'gpt');

    expect(classified.code).toBe('SERVICE_ERROR');
    expect(classified.logContext.statusCode).toBe(503);
  });

  it('should classify unknown errors with fallback message', () => {
    const error = new Error('Something unexpected');
    const classified = classifyError(error, 'unknown');

    expect(classified.code).toBe('UNKNOWN_ERROR');
    expect(classified.userMessage).toBe('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
  });

  it('should handle non-Error objects', () => {
    const classified = classifyError('string error', 'unknown');
    expect(classified.code).toBe('UNKNOWN_ERROR');
    expect(classified.logContext.originalError).toBe('string error');
  });
});
