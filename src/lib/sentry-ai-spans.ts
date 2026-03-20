// ─── Sentry AI Span Helpers ───────────────────────────────────────────────────
// Manual gen_ai.* instrumentation for the Azure OpenAI pipelines.
// Uses raw fetch (not the openai npm package) so automatic integration is
// unavailable — these helpers wrap each pipeline step with proper Sentry spans.
//
// Usage in route handlers:
//   import { withGptSpan, withWhisperSpan, withTtsSpan } from '@/lib/sentry-ai-spans';
//   const result = await withGptSpan('text-correction', prompt, () => callAzureGPT(...));

import * as Sentry from '@sentry/nextjs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TutorPipeline = 'text-correction' | 'audio-correction' | 'ocr-correction' | 'tts';

interface GptSpanOptions {
  pipeline: TutorPipeline;
  inputLength: number;
  model?: string;
  userId?: string;
}

interface WhisperSpanOptions {
  audioSizeBytes: number;
  audioType: string;
  userId?: string;
}

interface TtsSpanOptions {
  textLength: number;
  voice: string;
  userId?: string;
}

interface OcrSpanOptions {
  imageSizeBytes?: number;
  userId?: string;
}

// ─── GPT Correction Span ──────────────────────────────────────────────────────
// Wraps callAzureGPT() — captures model, latency, token estimates, errors.

export async function withGptSpan<T>(
  options: GptSpanOptions,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      op: 'gen_ai.request',
      name: `GPT correction (${options.pipeline})`,
      attributes: {
        'gen_ai.request.model': options.model ?? 'gpt-4o',
        'gen_ai.system': 'azure_openai',
        'tutor.pipeline': options.pipeline,
        'tutor.input_length': options.inputLength,
        ...(options.userId && { 'user.id': options.userId }),
      },
    },
    async (span) => {
      const start = performance.now();
      try {
        const result = await fn();
        const latencyMs = Math.round(performance.now() - start);
        span.setAttribute('gen_ai.latency_ms', latencyMs);
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (err) {
        span.setStatus({ code: 2, message: err instanceof Error ? err.message : 'unknown' });
        Sentry.captureException(err, {
          tags: {
            pipeline: options.pipeline,
            component: 'gpt',
            model: options.model ?? 'gpt-4o',
          },
          extra: { inputLength: options.inputLength },
        });
        throw err;
      }
    }
  );
}

// ─── Whisper Transcription Span ───────────────────────────────────────────────
// Wraps transcribeAudio() — captures audio metadata, latency, errors.

export async function withWhisperSpan<T>(
  options: WhisperSpanOptions,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      op: 'gen_ai.request',
      name: 'Whisper transcription',
      attributes: {
        'gen_ai.request.model': 'whisper',
        'gen_ai.system': 'azure_openai',
        'tutor.pipeline': 'audio-correction',
        'tutor.audio_size_bytes': options.audioSizeBytes,
        'tutor.audio_type': options.audioType,
        ...(options.userId && { 'user.id': options.userId }),
      },
    },
    async (span) => {
      const start = performance.now();
      try {
        const result = await fn();
        const latencyMs = Math.round(performance.now() - start);
        span.setAttribute('gen_ai.latency_ms', latencyMs);
        span.setStatus({ code: 1 });
        return result;
      } catch (err) {
        span.setStatus({ code: 2, message: err instanceof Error ? err.message : 'unknown' });
        Sentry.captureException(err, {
          tags: {
            pipeline: 'audio-correction',
            component: 'whisper',
          },
          extra: {
            audioSizeBytes: options.audioSizeBytes,
            audioType: options.audioType,
          },
        });
        throw err;
      }
    }
  );
}

// ─── TTS Synthesis Span ───────────────────────────────────────────────────────
// Wraps the Azure Speech TTS fetch — captures voice, text length, latency.

export async function withTtsSpan<T>(
  options: TtsSpanOptions,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      op: 'gen_ai.request',
      name: `TTS synthesis (${options.voice})`,
      attributes: {
        'gen_ai.request.model': `azure-tts-${options.voice.toLowerCase()}`,
        'gen_ai.system': 'azure_speech',
        'tutor.pipeline': 'tts',
        'tutor.tts_voice': options.voice,
        'tutor.input_length': options.textLength,
        ...(options.userId && { 'user.id': options.userId }),
      },
    },
    async (span) => {
      const start = performance.now();
      try {
        const result = await fn();
        const latencyMs = Math.round(performance.now() - start);
        span.setAttribute('gen_ai.latency_ms', latencyMs);
        span.setStatus({ code: 1 });
        return result;
      } catch (err) {
        span.setStatus({ code: 2, message: err instanceof Error ? err.message : 'unknown' });
        Sentry.captureException(err, {
          tags: { pipeline: 'tts', component: 'azure-speech' },
          extra: { voice: options.voice, textLength: options.textLength },
        });
        throw err;
      }
    }
  );
}

// ─── OCR Pipeline Span ────────────────────────────────────────────────────────
// Wraps the Tesseract OCR step — captures image size, latency, errors.

export async function withOcrSpan<T>(
  options: OcrSpanOptions,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      op: 'gen_ai.execute_tool',
      name: 'OCR extraction (Tesseract)',
      attributes: {
        'gen_ai.tool.name': 'tesseract_ocr',
        'gen_ai.tool.description': 'Client-side OCR using Tesseract.js for German text extraction',
        'tutor.pipeline': 'ocr-correction',
        ...(options.imageSizeBytes && { 'tutor.image_size_bytes': options.imageSizeBytes }),
        ...(options.userId && { 'user.id': options.userId }),
      },
    },
    async (span) => {
      const start = performance.now();
      try {
        const result = await fn();
        const latencyMs = Math.round(performance.now() - start);
        span.setAttribute('gen_ai.latency_ms', latencyMs);
        span.setStatus({ code: 1 });
        return result;
      } catch (err) {
        span.setStatus({ code: 2, message: err instanceof Error ? err.message : 'unknown' });
        Sentry.captureException(err, {
          tags: { pipeline: 'ocr-correction', component: 'tesseract' },
        });
        throw err;
      }
    }
  );
}

// ─── Full Pipeline Span ───────────────────────────────────────────────────────
// Top-level span wrapping an entire tutor pipeline invocation.
// Use this in the route handler to get a single trace per request.

export async function withTutorPipelineSpan<T>(
  pipeline: TutorPipeline,
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      op: 'gen_ai.invoke_agent',
      name: `Tutor pipeline: ${pipeline}`,
      attributes: {
        'gen_ai.agent.name': 'morodeutsch_tutor',
        'tutor.pipeline': pipeline,
        'user.id': userId,
      },
    },
    fn
  );
}

// ─── Capture non-throwing errors ──────────────────────────────────────────────
// For fire-and-forget operations (student model updates, accuracy tracking).

export function captureTutorWarning(
  message: string,
  context: Record<string, unknown>
) {
  Sentry.captureMessage(message, {
    level: 'warning',
    extra: context,
  });
}
