// ─── Test Helpers for Tutor API E2E Tests ────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CorrectionResult {
  original: string;
  corrected: string;
  error_categories: string[];
  error_type?: string | null;
  confidence?: number;
  explanation_de?: string;
  cefr_estimate: string;
  new_vocabulary?: Array<{ word: string; translation: string; cefr: string }>;
}

export interface TutorTextRequest {
  workflow: 'text-correction' | 'ocr-correction';
  text?: string;
  ocr_text?: string;
}

export interface TutorErrorResponse {
  error: string;
  errorCode?: string;
}

// ─── Mock Azure GPT Response Builder ─────────────────────────────────────────

export function buildMockGPTResponse(overrides: Partial<CorrectionResult> = {}): string {
  const base: CorrectionResult = {
    original: 'error_type' in overrides && overrides.original !== undefined ? overrides.original : (overrides.original ?? 'Ich gehe zu schule'),
    corrected: overrides.corrected ?? 'Ich gehe zur Schule',
    error_categories: overrides.error_categories ?? ['Präposition'],
    error_type: 'error_type' in overrides ? overrides.error_type : 'Präposition falsch',
    confidence: overrides.confidence ?? 0.92,
    explanation_de: overrides.explanation_de ?? 'Im Deutschen sagt man "zur Schule" (zu + der = zur).',
    cefr_estimate: overrides.cefr_estimate ?? 'A2',
    new_vocabulary: overrides.new_vocabulary ?? [
      { word: 'Schule', translation: 'school', cefr: 'A1' },
    ],
  };
  return JSON.stringify(base);
}

export function buildMockGPTChatResponse(content: string) {
  return {
    choices: [
      {
        message: {
          content,
        },
      },
    ],
  };
}

// ─── Mock Whisper Response Builder ───────────────────────────────────────────

export function buildMockWhisperResponse(text: string) {
  return { text };
}

// ─── Audio FormData Helper ───────────────────────────────────────────────────

export function createAudioBlob(sizeBytes: number, type = 'audio/webm'): Blob {
  const buffer = new Uint8Array(sizeBytes);
  // Fill with non-zero data to simulate real audio
  for (let i = 0; i < sizeBytes; i++) {
    buffer[i] = (i % 256);
  }
  return new Blob([buffer], { type });
}

export function createAudioFile(sizeBytes: number, name = 'audio.webm', type = 'audio/webm'): File {
  const buffer = new Uint8Array(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) {
    buffer[i] = (i % 256);
  }
  return new File([buffer], name, { type });
}

export function createAudioFormData(
  audioBlob: Blob | File,
  workflow = 'audio-correction',
  filename = 'audio.webm'
): FormData {
  const fd = new FormData();
  fd.append('workflow', workflow);
  if (audioBlob instanceof File) {
    fd.append('audio', audioBlob);
  } else {
    fd.append('audio', audioBlob, filename);
  }
  return fd;
}

// ─── CorrectionResult Shape Validator ────────────────────────────────────────

export function validateCorrectionResultShape(result: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof result !== 'object' || result === null) {
    return { valid: false, errors: ['Result is not an object'] };
  }

  const r = result as Record<string, unknown>;

  // Required fields
  if (typeof r.original !== 'string') {
    errors.push('Missing or invalid "original" (expected string)');
  }
  if (typeof r.corrected !== 'string') {
    errors.push('Missing or invalid "corrected" (expected string)');
  }
  if (!Array.isArray(r.error_categories)) {
    errors.push('Missing or invalid "error_categories" (expected array)');
  }
  if (typeof r.cefr_estimate !== 'string') {
    errors.push('Missing or invalid "cefr_estimate" (expected string)');
  }

  // Optional fields with type checks
  if (r.error_type !== undefined && r.error_type !== null && typeof r.error_type !== 'string') {
    errors.push('"error_type" should be string, null, or undefined');
  }
  if (r.confidence !== undefined && typeof r.confidence !== 'number') {
    errors.push('"confidence" should be number or undefined');
  }
  if (r.confidence !== undefined && typeof r.confidence === 'number') {
    if (r.confidence < 0 || r.confidence > 1) {
      errors.push(`"confidence" out of range [0,1]: ${r.confidence}`);
    }
  }
  if (r.explanation_de !== undefined && typeof r.explanation_de !== 'string') {
    errors.push('"explanation_de" should be string or undefined');
  }

  // Validate new_vocabulary array shape
  if (r.new_vocabulary !== undefined) {
    if (!Array.isArray(r.new_vocabulary)) {
      errors.push('"new_vocabulary" should be an array or undefined');
    } else {
      for (let i = 0; i < r.new_vocabulary.length; i++) {
        const v = r.new_vocabulary[i] as Record<string, unknown>;
        if (typeof v.word !== 'string') errors.push(`new_vocabulary[${i}].word should be string`);
        if (typeof v.translation !== 'string') errors.push(`new_vocabulary[${i}].translation should be string`);
        if (typeof v.cefr !== 'string') errors.push(`new_vocabulary[${i}].cefr should be string`);
      }
    }
  }

  // Validate CEFR level
  const validCEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (typeof r.cefr_estimate === 'string' && !validCEFR.includes(r.cefr_estimate)) {
    errors.push(`Invalid CEFR level: "${r.cefr_estimate}". Expected one of: ${validCEFR.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

// ─── Text Validation Logic (replicated from route.ts) ────────────────────────
// We replicate these since we cannot import from the Next.js route directly.

export function validateTextInput(text: string): { valid: boolean; error?: string } {
  if (!text || !text.trim()) {
    return { valid: false, error: 'Bitte geben Sie einen Text ein.' };
  }

  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).length;

  if (wordCount < 3) {
    return { valid: false, error: 'Der Text sollte mindestens 3 Wörter enthalten.' };
  }

  const hasLatinChars = /[a-zA-Z]/.test(trimmed);
  if (!hasLatinChars) {
    return { valid: false, error: 'Der Text sollte lateinische Zeichen enthalten.' };
  }

  return { valid: true };
}

export function validateAudioInput(file: { size: number; type: string }): { valid: boolean; error?: string } {
  const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB
  const MIN_AUDIO_BYTES = 100; // 100 bytes minimum

  if (file.size > MAX_AUDIO_BYTES) {
    return {
      valid: false,
      error: `Audio-Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum ist 25 MB.`,
    };
  }

  if (file.size < MIN_AUDIO_BYTES) {
    return { valid: false, error: 'Audio-Datei ist zu klein oder beschädigt.' };
  }

  const ALLOWED_TYPES = new Set([
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3',
    'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/aac',
    'audio/flac', 'audio/x-m4a',
  ]);
  const fileType = file.type?.toLowerCase() ?? '';

  if (fileType && !fileType.startsWith('audio/') && !ALLOWED_TYPES.has(fileType)) {
    return {
      valid: false,
      error: 'Audio-Format nicht unterstützt. Verwenden Sie MP3, WAV, OGG, FLAC oder WebM.',
    };
  }

  const estimatedSeconds = (file.size * 8) / (128 * 1024);
  const MAX_DURATION = 60 * 10; // 10 minutes
  const MIN_DURATION = 1;

  if (estimatedSeconds > MAX_DURATION) {
    return {
      valid: false,
      error: 'Audio-Datei ist zu lang (geschätzt über 10 Minuten). Bitte eine kürzere Aufnahme versuchen.',
    };
  }

  if (estimatedSeconds < MIN_DURATION && file.size > 500) {
    return {
      valid: false,
      error: 'Audio-Datei enthält zu wenig Audio-Daten. Bitte mindestens 1 Sekunde aufnehmen.',
    };
  }

  return { valid: true };
}

// ─── parseCorrectionResult (replicated from route.ts) ────────────────────────

export function parseCorrectionResult(
  text: string,
  fallbackOriginal: string,
  isAudio = false
): CorrectionResult {
  // Strip markdown code fences GPT occasionally wraps around JSON
  const stripped = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    throw new Error('INVALID_JSON_RESPONSE');
  }

  const errorType = parsed.error_type as string | null;
  const errorCategory = parsed.error_category as string;
  const rawConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;
  const confidence = Math.max(0, Math.min(1, rawConfidence));
  let explanationDe = (parsed.explanation_de as string) || '';

  // Add pronunciation guidance for audio if confidence is low
  if (isAudio && confidence < 0.7) {
    explanationDe += '\n\n💡 **Aussprache-Tipp:** Höre dir die richtige Aussprache an und vergleiche mit deiner Aufnahme.';
  }

  return {
    original: (parsed.original as string) || fallbackOriginal,
    corrected: (parsed.corrected as string) || fallbackOriginal,
    error_categories: errorType ? [errorCategory || 'Sonstiges'] : [],
    error_type: errorType,
    confidence,
    explanation_de: explanationDe,
    cefr_estimate: (parsed.cefr_estimate as string) || 'B1',
    new_vocabulary: (parsed.new_vocabulary as CorrectionResult['new_vocabulary']) || [],
  };
}

// ─── Error Classification (replicated from route.ts) ─────────────────────────

export interface ErrorContext {
  source: 'whisper' | 'gpt' | 'validation' | 'timeout' | 'unknown';
  statusCode?: number;
  originalError: string;
  timestamp: number;
}

export function classifyError(
  err: unknown,
  source: ErrorContext['source']
): { code: string; userMessage: string; logContext: ErrorContext } {
  const timestamp = Date.now();
  const originalError = err instanceof Error ? err.message : String(err);

  if (err instanceof Error && err.name === 'AbortError') {
    return {
      code: 'TIMEOUT',
      userMessage: 'Die Verarbeitung hat zu lange gedauert. Bitte versuchen Sie es mit kürzerem Text/Audio erneut.',
      logContext: { source, originalError, timestamp, statusCode: 408 },
    };
  }

  if (originalError.includes('rate limit') || originalError.includes('429')) {
    return {
      code: 'RATE_LIMIT',
      userMessage: 'Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
      logContext: { source, originalError, timestamp, statusCode: 429 },
    };
  }

  if (originalError.includes('401') || originalError.includes('403')) {
    return {
      code: 'AUTH_ERROR',
      userMessage: 'Authentifizierungsfehler. Bitte versuchen Sie es später erneut.',
      logContext: { source, originalError, timestamp, statusCode: 401 },
    };
  }

  if (originalError.includes('500') || originalError.includes('502') || originalError.includes('503')) {
    return {
      code: 'SERVICE_ERROR',
      userMessage: 'Der Service ist momentan nicht verfügbar. Bitte versuchen Sie es später erneut.',
      logContext: { source, originalError, timestamp, statusCode: 503 },
    };
  }

  if (source === 'whisper') {
    return {
      code: 'TRANSCRIPTION_FAILED',
      userMessage: 'Spracherkennung fehlgeschlagen. Bitte überprüfen Sie das Audio und versuchen Sie es erneut.',
      logContext: { source, originalError, timestamp },
    };
  }

  if (source === 'gpt') {
    return {
      code: 'GPT_FAILED',
      userMessage: 'Korrektur fehlgeschlagen. Bitte versuchen Sie es mit anderen Wörtern erneut.',
      logContext: { source, originalError, timestamp },
    };
  }

  if (source === 'validation') {
    return {
      code: 'VALIDATION_ERROR',
      userMessage: originalError,
      logContext: { source, originalError, timestamp },
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    userMessage: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    logContext: { source, originalError, timestamp },
  };
}
