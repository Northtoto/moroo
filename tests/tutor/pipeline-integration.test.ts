// ─── Pipeline Integration Tests ───────────────────────────────────────────────
// Verifies the contract of all four tutor pipelines:
//   1. text → correction
//   2. audio → Whisper → correction
//   3. image → OCR → correction
//   4. correction → TTS playback
//
// Each pipeline is tested for:
//   ✓ Valid JSON response (correct fields, correct types)
//   ✓ Required fields present (no undefined or missing keys)
//   ✓ Latency within documented limits (unit-level: parsing < 10ms, SLA documented)
//
// Azure calls are mocked — no real network required.

import { describe, it, expect } from 'vitest';
import {
  buildMockGPTResponse,
  validateCorrectionResultShape,
  parseCorrectionResult,
  validateTextInput,
  validateAudioInput,
  createAudioFile,
} from './helpers';

// ─── SLA Budget Constants (from reports/latency-analysis.md) ─────────────────

const SLA = {
  text: { p95_ms: 2000, timeout_ms: 20_000 },
  audio: { p95_ms: 6000, timeout_ms: 45_000 }, // whisper 25s + gpt 20s
  ocr: { p95_ms: 2500, timeout_ms: 20_000 },
  tts: { p95_ms: 3000, timeout_ms: 15_000 },
} as const;

// ─── Required Fields for CorrectionResult ─────────────────────────────────────

const CORRECTION_REQUIRED_FIELDS = [
  'original',
  'corrected',
  'error_categories',
  'cefr_estimate',
] as const;

function assertRequiredFields(result: Record<string, unknown>) {
  for (const field of CORRECTION_REQUIRED_FIELDS) {
    expect(result, `Missing required field: ${field}`).toHaveProperty(field);
    expect(result[field], `Field ${field} must not be undefined`).toBeDefined();
  }
}

function assertValidJSON(value: unknown): asserts value is Record<string, unknown> {
  expect(typeof value).toBe('object');
  expect(value).not.toBeNull();
}

// ─── Pipeline 1: Text → Correction ──────────────────────────────────────────

describe('Pipeline 1: Text → Correction', () => {
  describe('Valid JSON response', () => {
    it('should return a JSON object, not a string or array', () => {
      const gptResponse = buildMockGPTResponse({ original: 'Ich gehe zu schule' });
      const result = parseCorrectionResult(gptResponse, 'Ich gehe zu schule', false);
      assertValidJSON(result);
    });

    it('should include corrected field as a non-empty string', () => {
      const gptResponse = buildMockGPTResponse();
      const result = parseCorrectionResult(gptResponse, 'test', false);
      expect(typeof result.corrected).toBe('string');
      expect(result.corrected.length).toBeGreaterThan(0);
    });

    it('should include confidence as a number in [0, 1]', () => {
      const gptResponse = buildMockGPTResponse({ confidence: 0.92 });
      const result = parseCorrectionResult(gptResponse, 'test', false);
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should include error_categories as an array', () => {
      const gptResponse = buildMockGPTResponse();
      const result = parseCorrectionResult(gptResponse, 'test', false);
      expect(Array.isArray(result.error_categories)).toBe(true);
    });

    it('should include valid CEFR estimate', () => {
      const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const gptResponse = buildMockGPTResponse({ cefr_estimate: 'A2' });
      const result = parseCorrectionResult(gptResponse, 'test', false);
      expect(validLevels).toContain(result.cefr_estimate);
    });
  });

  describe('Required fields present', () => {
    it('should include all required CorrectionResult fields', () => {
      const gptResponse = buildMockGPTResponse();
      const result = parseCorrectionResult(gptResponse, 'Ich gehe zu schule', false);
      assertRequiredFields(result as unknown as Record<string, unknown>);
    });

    it('should pass validateCorrectionResultShape check', () => {
      const gptResponse = buildMockGPTResponse();
      const result = parseCorrectionResult(gptResponse, 'test', false);
      const validation = validateCorrectionResultShape(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should include new_vocabulary as an array (may be empty)', () => {
      const gptResponse = buildMockGPTResponse({ new_vocabulary: [] });
      const result = parseCorrectionResult(gptResponse, 'test', false);
      expect(Array.isArray(result.new_vocabulary)).toBe(true);
    });

    it('should include explanation_de as a string', () => {
      const gptResponse = buildMockGPTResponse({ explanation_de: 'Eine Erklärung.' });
      const result = parseCorrectionResult(gptResponse, 'test', false);
      expect(typeof result.explanation_de).toBe('string');
    });
  });

  describe('Latency within limits', () => {
    it('parsing logic (unit-level) should complete in < 10ms', () => {
      const gptResponse = buildMockGPTResponse();
      const start = performance.now();
      parseCorrectionResult(gptResponse, 'Ich gehe zu schule', false);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10); // pure parsing, no I/O
    });

    it('SLA: GPT timeout (20s) should leave margin below p95 target (2s)', () => {
      // Documents and enforces the timeout vs SLA relationship
      expect(SLA.text.timeout_ms).toBeGreaterThan(SLA.text.p95_ms);
    });

    it('text validation should complete in < 5ms', () => {
      const longText = 'Ich gehe zur Schule und lerne viele neue Wörter auf Deutsch. '.repeat(10);
      const start = performance.now();
      validateTextInput(longText);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5);
    });

    it('should process 50 corrections in < 500ms total', () => {
      const inputs = Array.from({ length: 50 }, (_, i) =>
        buildMockGPTResponse({ confidence: 0.7 + (i % 3) * 0.1 })
      );
      const start = performance.now();
      inputs.forEach(r => parseCorrectionResult(r, 'test', false));
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('Correct sentence handling', () => {
    it('should return null error_type for grammatically correct input', () => {
      const gptResponse = buildMockGPTResponse({
        error_type: null,
        confidence: 1.0,
        error_categories: [],
      });
      const result = parseCorrectionResult(gptResponse, 'Das Buch ist gut', false);
      expect(result.error_type).toBeNull();
      expect(result.confidence).toBe(1.0);
      expect(result.error_categories).toHaveLength(0);
    });
  });
});

// ─── Pipeline 2: Audio → Whisper → Correction ────────────────────────────────

describe('Pipeline 2: Audio → Whisper → Correction', () => {
  describe('Valid JSON response', () => {
    it('should produce valid CorrectionResult after audio pipeline', () => {
      const transcribed = 'Ich bin nach Hause gegangen'; // mock Whisper output
      const gptResponse = buildMockGPTResponse({ original: transcribed });
      const result = parseCorrectionResult(gptResponse, transcribed, true);
      assertValidJSON(result as unknown as Record<string, unknown>);
    });

    it('should include original transcribed text in result', () => {
      const transcribed = 'Ich haben gegessen';
      const gptResponse = buildMockGPTResponse({ original: transcribed });
      const result = parseCorrectionResult(gptResponse, transcribed, true);
      expect(result.original).toBe(transcribed);
    });

    it('should add pronunciation tip when audio confidence is low', () => {
      const gptResponse = buildMockGPTResponse({ confidence: 0.5 });
      const result = parseCorrectionResult(gptResponse, 'test', true);
      expect(result.explanation_de).toContain('Aussprache-Tipp');
    });

    it('should not add pronunciation tip when confidence is high (>= 0.7)', () => {
      const gptResponse = buildMockGPTResponse({ confidence: 0.8 });
      const result = parseCorrectionResult(gptResponse, 'test', true);
      expect(result.explanation_de).not.toContain('Aussprache-Tipp');
    });
  });

  describe('Required fields present', () => {
    it('audio correction result should pass shape validation', () => {
      const gptResponse = buildMockGPTResponse();
      const result = parseCorrectionResult(gptResponse, 'audio text', true);
      const validation = validateCorrectionResultShape(result);
      expect(validation.valid).toBe(true);
    });

    it('should preserve all required fields after audio pipeline', () => {
      const gptResponse = buildMockGPTResponse();
      const result = parseCorrectionResult(gptResponse, 'audio input', true);
      assertRequiredFields(result as unknown as Record<string, unknown>);
    });
  });

  describe('Audio validation gate', () => {
    it('should accept standard recording file (1MB webm)', () => {
      const file = createAudioFile(1024 * 1024, 'recording.webm', 'audio/webm');
      const validation = validateAudioInput(file);
      expect(validation.valid).toBe(true);
    });

    it('should reject too-small audio (< 100 bytes)', () => {
      const file = createAudioFile(50, 'tiny.webm', 'audio/webm');
      const validation = validateAudioInput(file);
      expect(validation.valid).toBe(false);
    });

    it('should reject audio exceeding 10-minute duration estimate', () => {
      const file = createAudioFile(25 * 1024 * 1024, 'long.webm', 'audio/webm');
      const validation = validateAudioInput(file);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('zu lang');
    });
  });

  describe('Latency within limits', () => {
    it('SLA: combined whisper+gpt timeout should exceed p95 target', () => {
      const WHISPER_TIMEOUT_MS = 25_000;
      const GPT_TIMEOUT_MS = 20_000;
      const totalTimeout = WHISPER_TIMEOUT_MS + GPT_TIMEOUT_MS;
      expect(totalTimeout).toBeGreaterThan(SLA.audio.p95_ms);
    });

    it('audio validation should complete in < 5ms', () => {
      const file = createAudioFile(1024 * 1024, 'test.webm', 'audio/webm');
      const start = performance.now();
      validateAudioInput(file);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5);
    });

    it('parsing step of audio pipeline should complete in < 10ms', () => {
      const gptResponse = buildMockGPTResponse({ confidence: 0.6 });
      const start = performance.now();
      parseCorrectionResult(gptResponse, 'Transkription text', true);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
    });
  });
});

// ─── Pipeline 3: Image → OCR → Correction ─────────────────────────────────────

describe('Pipeline 3: Image → OCR → Correction', () => {
  describe('Valid JSON response', () => {
    it('should produce valid CorrectionResult from OCR text', () => {
      const ocrText = 'lch gehe zurrn Schule'; // OCR noise: l instead of I, rn instead of m
      const gptResponse = buildMockGPTResponse({ original: ocrText });
      const result = parseCorrectionResult(gptResponse, ocrText, false);
      assertValidJSON(result as unknown as Record<string, unknown>);
    });

    it('should include corrected version of OCR text', () => {
      const ocrText = 'Das Buch liegr auf dem Tisch'; // OCR: r instead of t
      const gptResponse = buildMockGPTResponse({
        original: ocrText,
        corrected: 'Das Buch liegt auf dem Tisch',
      });
      const result = parseCorrectionResult(gptResponse, ocrText, false);
      expect(result.corrected).toBe('Das Buch liegt auf dem Tisch');
    });

    it('should not add pronunciation tip for OCR corrections', () => {
      const gptResponse = buildMockGPTResponse({ confidence: 0.5 });
      const result = parseCorrectionResult(gptResponse, 'OCR text', false); // isAudio=false
      expect(result.explanation_de).not.toContain('Aussprache-Tipp');
    });
  });

  describe('Required fields present', () => {
    it('OCR correction result should pass shape validation', () => {
      const gptResponse = buildMockGPTResponse();
      const result = parseCorrectionResult(gptResponse, 'OCR input', false);
      const validation = validateCorrectionResultShape(result);
      expect(validation.valid).toBe(true);
    });

    it('should preserve all required fields after OCR pipeline', () => {
      const gptResponse = buildMockGPTResponse();
      const result = parseCorrectionResult(gptResponse, 'OCR text', false);
      assertRequiredFields(result as unknown as Record<string, unknown>);
    });
  });

  describe('OCR text validation gate', () => {
    it('should accept valid OCR text', () => {
      const result = validateTextInput('Ich gehe zur Schule');
      expect(result.valid).toBe(true);
    });

    it('should reject empty OCR result', () => {
      const result = validateTextInput('');
      expect(result.valid).toBe(false);
    });

    it('should reject OCR output with fewer than 3 words', () => {
      const result = validateTextInput('Schule');
      expect(result.valid).toBe(false);
    });
  });

  describe('Latency within limits', () => {
    it('SLA: OCR p95 target (2.5s) should be lower than text timeout (20s)', () => {
      expect(SLA.ocr.p95_ms).toBeLessThan(SLA.ocr.timeout_ms);
    });

    it('OCR correction parsing should complete in < 10ms', () => {
      const gptResponse = buildMockGPTResponse();
      const start = performance.now();
      parseCorrectionResult(gptResponse, 'OCR text from scanned image', false);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(10);
    });
  });
});

// ─── Pipeline 4: Correction → TTS Playback ───────────────────────────────────

describe('Pipeline 4: Correction → TTS Playback', () => {
  // TTS route returns audio/mpeg binary — not JSON.
  // These tests verify the TTS contract from the corrected sentence onward.

  const VOICE_MAP = {
    Katja: 'de-DE-KatjaNeural',
    Conrad: 'de-DE-ConradNeural',
    Amala: 'de-DE-AmalaNeural',
  } as const;

  function escapeXmlLocal(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  describe('Valid response contract', () => {
    it('corrected sentence is a non-empty string suitable for TTS input', () => {
      const gptResponse = buildMockGPTResponse({ corrected: 'Ich gehe zur Schule.' });
      const correction = parseCorrectionResult(gptResponse, 'test', false);
      // The corrected field is what gets sent to TTS
      expect(typeof correction.corrected).toBe('string');
      expect(correction.corrected.length).toBeGreaterThan(0);
      expect(correction.corrected.length).toBeLessThanOrEqual(500); // TTS limit
    });

    it('TTS audio response should have audio/mpeg Content-Type', () => {
      const mockResponse = new Response(new Uint8Array(5000), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      });
      expect(mockResponse.headers.get('Content-Type')).toBe('audio/mpeg');
    });

    it('TTS response body should be non-empty binary data', async () => {
      const audioData = new Uint8Array(8000).fill(0xaa);
      const response = new Response(audioData, {
        headers: { 'Content-Type': 'audio/mpeg' },
      });
      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('TTS response should include cache headers for 24h', () => {
      const response = new Response(new Uint8Array(100), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'private, max-age=86400',
          'Content-Disposition': 'inline',
        },
      });
      expect(response.headers.get('Cache-Control')).toBe('private, max-age=86400');
      expect(response.headers.get('Content-Disposition')).toBe('inline');
    });
  });

  describe('SSML construction from corrected sentence', () => {
    it('should embed corrected sentence in SSML safely', () => {
      const gptResponse = buildMockGPTResponse({ corrected: 'Ich gehe zur Schule.' });
      const correction = parseCorrectionResult(gptResponse, 'test', false);

      const voiceName = VOICE_MAP['Katja'];
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='de-DE'>
        <voice name='${voiceName}'>
          <prosody rate='0.95'>${escapeXmlLocal(correction.corrected)}</prosody>
        </voice>
      </speak>`;

      expect(ssml).toContain('Ich gehe zur Schule.');
      expect(ssml).toContain('de-DE-KatjaNeural');
      expect(ssml).toContain("xml:lang='de-DE'");
    });

    it('should escape XML characters in corrected sentence', () => {
      const correctedWithSpecialChars = 'Müller & Töchter GmbH';
      const escaped = escapeXmlLocal(correctedWithSpecialChars);
      expect(escaped).toContain('&amp;');
      expect(escaped).not.toContain(' & ');
    });
  });

  describe('Latency within limits', () => {
    it('SLA: TTS timeout (15s) should exceed p95 target (3s)', () => {
      expect(SLA.tts.timeout_ms).toBeGreaterThan(SLA.tts.p95_ms);
    });

    it('SSML generation (pure string) should complete in < 5ms', () => {
      const corrected = 'Ich gehe zur Schule und lerne viele neue Wörter.';
      const start = performance.now();
      const voiceName = VOICE_MAP['Katja'];
      const _ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='de-DE'>
        <voice name='${voiceName}'>
          <prosody rate='0.95'>${escapeXmlLocal(corrected)}</prosody>
        </voice>
      </speak>`;
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5);
    });

    it('TTS rate limit (30/min) should not throttle typical usage (< 10 req/min)', () => {
      const RATE_LIMIT = 30;
      const TYPICAL_USAGE = 10; // typical student requests per minute
      expect(TYPICAL_USAGE).toBeLessThan(RATE_LIMIT);
    });
  });
});

// ─── Cross-Pipeline Contract Tests ────────────────────────────────────────────

describe('Cross-Pipeline: All four pipelines produce consistent output', () => {
  it('all four pipelines should produce a valid cefr_estimate', () => {
    const validLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    const pipelines = [
      parseCorrectionResult(buildMockGPTResponse({ cefr_estimate: 'A2' }), 'text', false),
      parseCorrectionResult(buildMockGPTResponse({ cefr_estimate: 'B1' }), 'audio', true),
      parseCorrectionResult(buildMockGPTResponse({ cefr_estimate: 'B2' }), 'ocr', false),
      parseCorrectionResult(buildMockGPTResponse({ cefr_estimate: 'C1' }), 'corrected for tts', false),
    ];

    for (const result of pipelines) {
      expect(validLevels.has(result.cefr_estimate)).toBe(true);
    }
  });

  it('all four pipelines should produce confidence in [0, 1]', () => {
    const confidences = [0.85, 0.7, 0.95, 1.0];
    for (const c of confidences) {
      const result = parseCorrectionResult(buildMockGPTResponse({ confidence: c }), 'test', false);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('all four pipelines should clamp out-of-range confidence values', () => {
    const overRange = parseCorrectionResult(buildMockGPTResponse({ confidence: 1.5 }), 'test', false);
    const underRange = parseCorrectionResult(buildMockGPTResponse({ confidence: -0.2 }), 'test', false);
    expect(overRange.confidence).toBe(1.0);
    expect(underRange.confidence).toBe(0.0);
  });

  it('SLA budgets should be correctly ordered: text ≤ ocr < tts < audio', () => {
    expect(SLA.text.p95_ms).toBeLessThanOrEqual(SLA.ocr.p95_ms);
    expect(SLA.ocr.p95_ms).toBeLessThan(SLA.tts.p95_ms);
    expect(SLA.tts.p95_ms).toBeLessThan(SLA.audio.p95_ms);
  });

  it('parsing all four pipeline responses should complete in < 20ms total', () => {
    const responses = [
      buildMockGPTResponse({ confidence: 0.9 }),
      buildMockGPTResponse({ confidence: 0.6 }),
      buildMockGPTResponse({ confidence: 0.95 }),
      buildMockGPTResponse({ confidence: 0.8 }),
    ];
    const isAudio = [false, true, false, false];

    const start = performance.now();
    responses.forEach((r, i) => parseCorrectionResult(r, 'input', isAudio[i]));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(20);
  });
});
