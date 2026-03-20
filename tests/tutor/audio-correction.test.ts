// ─── Audio Correction Tests ──────────────────────────────────────────────────
// Tests for the audio-correction workflow: audio validation, Whisper+GPT
// pipeline mocking, and error handling.

import { describe, it, expect, vi } from 'vitest';
import {
  validateAudioInput,
  parseCorrectionResult,
  validateCorrectionResultShape,
  buildMockGPTResponse,
  buildMockWhisperResponse,
  buildMockGPTChatResponse,
  createAudioBlob,
  createAudioFile,
  createAudioFormData,
  classifyError,
} from './helpers';

// ─── Audio Input Validation ──────────────────────────────────────────────────

describe('Audio Input Validation', () => {
  it('should accept valid audio file (normal size, correct type)', () => {
    const file = { size: 500_000, type: 'audio/webm' };
    const result = validateAudioInput(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject audio smaller than 100 bytes', () => {
    const file = { size: 50, type: 'audio/webm' };
    const result = validateAudioInput(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('zu klein');
  });

  it('should reject audio larger than 25MB', () => {
    const size = 26 * 1024 * 1024; // 26 MB
    const file = { size, type: 'audio/webm' };
    const result = validateAudioInput(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('zu groß');
    expect(result.error).toContain('25 MB');
  });

  it('should accept all allowed MIME types', () => {
    const allowedTypes = [
      'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3',
      'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/aac',
      'audio/flac', 'audio/x-m4a',
    ];

    for (const type of allowedTypes) {
      const file = { size: 100_000, type };
      const result = validateAudioInput(file);
      expect(result.valid).toBe(true);
    }
  });

  it('should reject non-audio MIME type (e.g., application/pdf)', () => {
    const file = { size: 100_000, type: 'application/pdf' };
    const result = validateAudioInput(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('nicht unterstützt');
  });

  it('should accept file with empty MIME type (permissive)', () => {
    // Empty type is allowed (browsers sometimes don't set it)
    const file = { size: 100_000, type: '' };
    const result = validateAudioInput(file);
    expect(result.valid).toBe(true);
  });

  it('should reject estimated audio longer than 10 minutes', () => {
    // At 128kbps, 10 min = 10*60*128*1024/8 = ~9.8MB
    // Use a size that estimates >600 seconds
    const sizeFor11Min = Math.ceil((11 * 60 * 128 * 1024) / 8);
    const file = { size: sizeFor11Min, type: 'audio/webm' };
    const result = validateAudioInput(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('zu lang');
  });

  it('should accept audio well within size and duration limits', () => {
    // 5MB at estimated 128kbps ≈ 312s (under 10min limit) and under 25MB size limit
    const file = { size: 5 * 1024 * 1024, type: 'audio/webm' };
    const result = validateAudioInput(file);
    expect(result.valid).toBe(true);
  });

  it('should reject audio at exactly 25MB when duration estimate exceeds 10min', () => {
    // 25MB at 128kbps ≈ 1534s (over 10min limit) — fails duration check before size check
    const file = { size: 25 * 1024 * 1024, type: 'audio/webm' };
    const result = validateAudioInput(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('zu lang');
  });

  it('should accept audio at exactly 100 bytes boundary', () => {
    const file = { size: 100, type: 'audio/webm' };
    const result = validateAudioInput(file);
    expect(result.valid).toBe(true);
  });
});

// ─── Audio Blob & FormData Creation ──────────────────────────────────────────

describe('Audio Blob and FormData Helpers', () => {
  it('should create an audio blob of the correct size', () => {
    const blob = createAudioBlob(1024);
    expect(blob.size).toBe(1024);
    expect(blob.type).toBe('audio/webm');
  });

  it('should create an audio file with name and type', () => {
    const file = createAudioFile(2048, 'recording.mp3', 'audio/mp3');
    expect(file.size).toBe(2048);
    expect(file.name).toBe('recording.mp3');
    expect(file.type).toBe('audio/mp3');
  });

  it('should create FormData with workflow and audio fields', () => {
    const blob = createAudioBlob(1024);
    const fd = createAudioFormData(blob, 'audio-correction', 'test.webm');
    expect(fd.get('workflow')).toBe('audio-correction');
    expect(fd.get('audio')).toBeTruthy();
  });
});

// ─── Mocked Audio Pipeline (Whisper → GPT) ──────────────────────────────────

describe('Audio Correction Pipeline (Mocked)', () => {
  it('should produce a valid correction from transcribed audio', () => {
    // Simulate Whisper transcription
    const whisperResponse = buildMockWhisperResponse('Ich gehe zu schule');
    expect(whisperResponse.text).toBe('Ich gehe zu schule');

    // Simulate GPT correction of the transcription
    const gptContent = buildMockGPTResponse({
      original: whisperResponse.text,
      corrected: 'Ich gehe zur Schule.',
      error_type: 'Präposition falsch',
      confidence: 0.88,
      explanation_de: 'Verwende "zur" (zu + der) vor femininen Nomen.',
      cefr_estimate: 'A2',
    });

    const result = parseCorrectionResult(gptContent, whisperResponse.text, true);

    expect(result.original).toBe('Ich gehe zu schule');
    expect(result.corrected).toBe('Ich gehe zur Schule.');
    expect(result.confidence).toBe(0.88);

    const validation = validateCorrectionResultShape(result);
    expect(validation.valid).toBe(true);
  });

  it('should add pronunciation tip for audio with low confidence', () => {
    const gptContent = buildMockGPTResponse({
      original: 'Ich abe ein Hund',
      corrected: 'Ich habe einen Hund.',
      error_type: 'Artikel-Fehler',
      confidence: 0.55, // Below 0.7 threshold
      explanation_de: 'Akkusativ: "einen Hund" statt "ein Hund".',
      cefr_estimate: 'A1',
    });

    const result = parseCorrectionResult(gptContent, 'Ich abe ein Hund', true);

    expect(result.confidence).toBe(0.55);
    expect(result.explanation_de).toContain('Aussprache-Tipp');
  });

  it('should NOT add pronunciation tip for audio with high confidence', () => {
    const gptContent = buildMockGPTResponse({
      original: 'Ich gehe zu schule',
      corrected: 'Ich gehe zur Schule.',
      error_type: 'Präposition falsch',
      confidence: 0.92, // Above 0.7 threshold
      explanation_de: 'Verwende "zur" statt "zu".',
      cefr_estimate: 'A2',
    });

    const result = parseCorrectionResult(gptContent, 'Ich gehe zu schule', true);

    expect(result.confidence).toBe(0.92);
    expect(result.explanation_de).not.toContain('Aussprache-Tipp');
  });

  it('should NOT add pronunciation tip for non-audio (text) corrections', () => {
    const gptContent = buildMockGPTResponse({
      original: 'Ich abe ein Hund',
      corrected: 'Ich habe einen Hund.',
      error_type: 'Artikel-Fehler',
      confidence: 0.55,
      explanation_de: 'Akkusativ erfordert "einen".',
      cefr_estimate: 'A1',
    });

    // isAudio = false
    const result = parseCorrectionResult(gptContent, 'Ich abe ein Hund', false);

    expect(result.explanation_de).not.toContain('Aussprache-Tipp');
  });

  it('should simulate full pipeline timing structure', () => {
    const pipelineStart = performance.now();

    // Step 1: Whisper transcription (simulated)
    const whisperStart = performance.now();
    const whisperResponse = buildMockWhisperResponse('Der Katze ist schön');
    const whisperDuration = performance.now() - whisperStart;

    // Step 2: GPT correction (simulated)
    const gptStart = performance.now();
    const gptContent = buildMockGPTResponse({
      original: whisperResponse.text,
      corrected: 'Die Katze ist schön.',
      error_type: 'Artikel-Fehler',
      confidence: 0.9,
      cefr_estimate: 'A1',
    });
    const result = parseCorrectionResult(gptContent, whisperResponse.text, true);
    const gptDuration = performance.now() - gptStart;

    const totalDuration = performance.now() - pipelineStart;

    // Verify timing structure is correct
    expect(whisperDuration).toBeGreaterThanOrEqual(0);
    expect(gptDuration).toBeGreaterThanOrEqual(0);
    expect(totalDuration).toBeGreaterThanOrEqual(whisperDuration);
    expect(result.corrected).toBe('Die Katze ist schön.');
  });
});

// ─── Audio Error Classification ──────────────────────────────────────────────

describe('Audio Correction - Error Classification', () => {
  it('should classify whisper transcription failures', () => {
    const error = new Error('TRANSCRIPTION_FAILED');
    const classified = classifyError(error, 'whisper');

    expect(classified.code).toBe('TRANSCRIPTION_FAILED');
    expect(classified.userMessage).toContain('Spracherkennung fehlgeschlagen');
    expect(classified.logContext.source).toBe('whisper');
  });

  it('should classify empty transcription as whisper error', () => {
    const error = new Error('EMPTY_TRANSCRIPTION');
    const classified = classifyError(error, 'whisper');

    expect(classified.code).toBe('TRANSCRIPTION_FAILED');
    expect(classified.logContext.source).toBe('whisper');
  });

  it('should classify timeout errors in audio pipeline', () => {
    const error = new Error('TIMEOUT');
    // Simulate AbortError
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    const classified = classifyError(abortError, 'whisper');

    expect(classified.code).toBe('TIMEOUT');
    expect(classified.userMessage).toContain('zu lange gedauert');
    expect(classified.logContext.statusCode).toBe(408);
  });

  it('should classify invalid JSON from Whisper as whisper error', () => {
    const error = new Error('INVALID_JSON_RESPONSE');
    const classified = classifyError(error, 'whisper');

    expect(classified.code).toBe('TRANSCRIPTION_FAILED');
  });
});
