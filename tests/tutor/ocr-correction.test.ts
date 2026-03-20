// ─── OCR Correction Tests ────────────────────────────────────────────────────
// Tests for the ocr-correction workflow: text validation for OCR input,
// cleaning of noisy OCR text, and correction response parsing.

import { describe, it, expect } from 'vitest';
import {
  validateTextInput,
  parseCorrectionResult,
  validateCorrectionResultShape,
  buildMockGPTResponse,
  classifyError,
} from './helpers';

// ─── OCR Text Validation ─────────────────────────────────────────────────────

describe('OCR Text Input Validation', () => {
  it('should accept valid OCR text input', () => {
    const result = validateTextInput('Ich bin ein Student in Berlin');
    expect(result.valid).toBe(true);
  });

  it('should reject empty OCR text', () => {
    const result = validateTextInput('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Bitte geben Sie einen Text ein.');
  });

  it('should reject OCR text that is only whitespace/noise', () => {
    const result = validateTextInput('   \n\n   ');
    expect(result.valid).toBe(false);
  });

  it('should accept OCR text with minor noise characters mixed with German', () => {
    // OCR often introduces stray characters
    const result = validateTextInput('lch gehe zur Schule. ~');
    expect(result.valid).toBe(true);
  });

  it('should accept OCR text with umlauts', () => {
    const result = validateTextInput('Über die Brücke gehen');
    expect(result.valid).toBe(true);
  });

  it('should reject pure non-Latin OCR output (e.g., all symbols)', () => {
    const result = validateTextInput('⬛⬛⬛ ⬛⬛⬛ ⬛⬛⬛');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('lateinische Zeichen');
  });
});

// ─── OCR Correction Response Parsing ─────────────────────────────────────────

describe('OCR Correction - GPT Response Parsing', () => {
  it('should parse a correction for OCR-scanned text', () => {
    const gptContent = buildMockGPTResponse({
      original: 'lch gehe zum Schule',
      corrected: 'Ich gehe zur Schule.',
      error_type: 'Präposition falsch',
      confidence: 0.85,
      explanation_de: 'Aus einem Scan erkannt: "lch" ist "Ich". "zur Schule" ist korrekt (feminin).',
      cefr_estimate: 'A2',
    });

    const result = parseCorrectionResult(gptContent, 'lch gehe zum Schule', false);

    expect(result.original).toBe('lch gehe zum Schule');
    expect(result.corrected).toBe('Ich gehe zur Schule.');
    expect(result.explanation_de).toContain('Scan');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should handle OCR text with mixed German and noise', () => {
    const noisyOcrText = 'D1e Katze s1tzt auf dem T1sch';
    const gptContent = buildMockGPTResponse({
      original: noisyOcrText,
      corrected: 'Die Katze sitzt auf dem Tisch.',
      error_type: 'Rechtschreibung',
      confidence: 0.75,
      explanation_de: 'OCR-Fehler: "1" wurde statt "i" erkannt.',
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(gptContent, noisyOcrText, false);

    expect(result.corrected).toBe('Die Katze sitzt auf dem Tisch.');
    expect(result.error_type).toBe('Rechtschreibung');
    expect(result.confidence).toBe(0.75);
  });

  it('should produce valid shape for OCR correction results', () => {
    const gptContent = buildMockGPTResponse({
      original: 'Mein Bruder wohnt in Munchen',
      corrected: 'Mein Bruder wohnt in München.',
      error_type: 'Rechtschreibung',
      confidence: 0.9,
      cefr_estimate: 'A2',
      new_vocabulary: [
        { word: 'München', translation: 'Munich', cefr: 'A1' },
      ],
    });

    const result = parseCorrectionResult(gptContent, 'Mein Bruder wohnt in Munchen', false);
    const validation = validateCorrectionResultShape(result);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should not add pronunciation tip for OCR corrections (isAudio=false)', () => {
    const gptContent = buildMockGPTResponse({
      original: 'lch habe',
      corrected: 'Ich habe.',
      error_type: 'Rechtschreibung',
      confidence: 0.4, // Low confidence but NOT audio
      explanation_de: 'OCR-Fehler bei "lch".',
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(gptContent, 'lch habe', false);
    expect(result.explanation_de).not.toContain('Aussprache-Tipp');
  });
});

// ─── OCR-specific Edge Cases ─────────────────────────────────────────────────

describe('OCR Correction - Edge Cases', () => {
  it('should handle OCR text with line breaks and formatting artifacts', () => {
    const ocrText = 'Ich gehe\nzur Schule\nund lerne';
    const result = validateTextInput(ocrText);
    expect(result.valid).toBe(true);
  });

  it('should handle OCR text with duplicate spaces', () => {
    const ocrText = 'Ich  gehe   zur    Schule';
    const result = validateTextInput(ocrText);
    expect(result.valid).toBe(true);
  });

  it('should handle OCR text with special German characters (ß, umlauts)', () => {
    const ocrText = 'Die Straße ist groß und schön';
    const result = validateTextInput(ocrText);
    expect(result.valid).toBe(true);
  });

  it('should classify GPT failures during OCR correction', () => {
    const error = new Error('GPT_FAILED');
    const classified = classifyError(error, 'gpt');

    expect(classified.code).toBe('GPT_FAILED');
    expect(classified.userMessage).toContain('Korrektur fehlgeschlagen');
  });
});
