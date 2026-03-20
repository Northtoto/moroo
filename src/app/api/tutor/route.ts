// ─── Tutor API Route ──────────────────────────────────────────────────
// Calls Azure OpenAI directly (no n8n dependency).
// Supports: text-correction, audio-correction (Whisper -> GPT), ocr-correction
// FIXED: Added comprehensive error logging and diagnostics

import { NextRequest, NextResponse } from 'next/server';
import { withApiGuard } from '@/lib/api-guard';
import { buildN8nContext, updateStudentModel, type CorrectionResult } from '@/lib/student-model';
import { updateAccuracy } from '@/lib/adaptive-engine';
import { logger } from '@/lib/logger';

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT ?? '';
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY ?? '';
const GPT_DEPLOYMENT = process.env.AZURE_OPENAI_GPT_DEPLOYMENT ?? 'gpt-4o';
const WHISPER_DEPLOYMENT = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? 'whisper';
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION ?? '2024-12-01-preview';

const ALLOWED_WORKFLOWS = ['text-correction', 'audio-correction', 'ocr-correction'] as const;
type Workflow = typeof ALLOWED_WORKFLOWS[number];

// Helper: Detailed logging with context
function logAudio(stage: string, data: Record<string, any>) {
  console.log(`[tutor:audio:${stage}]`, JSON.stringify(data, null, 2));
}

// ─── Error Classification & Handling ────────────────────────────────────
// Translates low-level errors into user-friendly German messages

interface ErrorContext {
  source: 'whisper' | 'gpt' | 'validation' | 'timeout' | 'unknown';
  statusCode?: number;
  originalError: string;
  timestamp: number;
}

function classifyError(err: unknown, source: ErrorContext['source']): { code: string; userMessage: string; logContext: ErrorContext } {
  const timestamp = Date.now();
  const originalError = err instanceof Error ? err.message : String(err);
  
  // Check for timeout (AbortError has name === 'AbortError')
  if (err instanceof Error && err.name === 'AbortError') {
    return {
      code: 'TIMEOUT',
      userMessage: 'Die Verarbeitung hat zu lange gedauert. Bitte versuchen Sie es mit kürzerem Text/Audio erneut.',
      logContext: { source, originalError, timestamp, statusCode: 408 }
    };
  }

  // Azure-specific errors
  if (originalError.includes('rate limit') || originalError.includes('429')) {
    return {
      code: 'RATE_LIMIT',
      userMessage: 'Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
      logContext: { source, originalError, timestamp, statusCode: 429 }
    };
  }

  if (originalError.includes('401') || originalError.includes('403')) {
    return {
      code: 'AUTH_ERROR',
      userMessage: 'Authentifizierungsfehler. Bitte versuchen Sie es später erneut.',
      logContext: { source, originalError, timestamp, statusCode: 401 }
    };
  }

  if (originalError.includes('500') || originalError.includes('502') || originalError.includes('503')) {
    return {
      code: 'SERVICE_ERROR',
      userMessage: 'Der Service ist momentan nicht verfügbar. Bitte versuchen Sie es später erneut.',
      logContext: { source, originalError, timestamp, statusCode: 503 }
    };
  }

  // Source-specific defaults
  if (source === 'whisper') {
    return {
      code: 'TRANSCRIPTION_FAILED',
      userMessage: 'Spracherkennung fehlgeschlagen. Bitte überprüfen Sie das Audio und versuchen Sie es erneut.',
      logContext: { source, originalError, timestamp }
    };
  }

  if (source === 'gpt') {
    return {
      code: 'GPT_FAILED',
      userMessage: 'Korrektur fehlgeschlagen. Bitte versuchen Sie es mit anderen Wörtern erneut.',
      logContext: { source, originalError, timestamp }
    };
  }

  if (source === 'validation') {
    // Note: validation errors should have custom message in validation logic
    return {
      code: 'VALIDATION_ERROR',
      userMessage: originalError, // Already user-friendly from validator
      logContext: { source, originalError, timestamp }
    };
  }

  // Fallback
  return {
    code: 'UNKNOWN_ERROR',
    userMessage: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    logContext: { source, originalError, timestamp }
  };
}

// ─── Call Azure Whisper ────────────────────────────────────────────────

async function transcribeAudio(audioBlob: Blob, filename: string): Promise<string> {
  const url = `${AZURE_ENDPOINT}/openai/deployments/${WHISPER_DEPLOYMENT}/audio/transcriptions?api-version=2024-06-01`;
  
  logAudio('init', {
    endpoint: AZURE_ENDPOINT,
    deployment: WHISPER_DEPLOYMENT,
    url,
    blobSize: audioBlob.size,
    filename,
  });

  const fd = new FormData();
  fd.append('file', audioBlob, filename);
  fd.append('language', 'de');
  fd.append('response_format', 'json');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': AZURE_API_KEY },
      body: fd,
      signal: AbortSignal.timeout(25_000), // 25s — Whisper is slow on long audio
    });

    logAudio('response', {
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type'),
    });

    const responseText = await res.text();
    logAudio('response-body', {
      length: responseText.length,
      preview: responseText.substring(0, 300),
    });

    if (!res.ok) {
      console.error('[tutor:audio] Whisper API error', {
        status: res.status,
        statusText: res.statusText,
        bodyPreview: responseText.substring(0, 200),
      });
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText) as { text?: string };
    } catch (parseErr) {
      console.error('[tutor:audio] Failed to parse Whisper response', {
        error: String(parseErr),
        responseLength: responseText.length,
        isValidJSON: responseText.startsWith('{'),
      });
      throw new Error('INVALID_JSON_RESPONSE');
    }

    // Validate transcription result
    if (!data.text) {
      console.warn('[tutor:audio] Whisper returned no text (empty audio or no speech detected)', { data });
      throw new Error('EMPTY_TRANSCRIPTION');
    }

    const text = data.text.trim();
    if (text.length === 0) {
      console.warn('[tutor:audio] Transcribed text is empty after trimming');
      throw new Error('EMPTY_TRANSCRIPTION');
    }

    console.log('[tutor:audio] Transcription successful', {
      textLength: text.length,
      words: text.split(/\s+/).length,
    });

    logAudio('success', { transcribedText: data.text });
    return data.text;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logAudio('catch-error', { error: errorMsg });
    throw err;
  }
}

// ─── Call Azure GPT ────────────────────────────────────────────────────

async function callAzureGPT(systemPrompt: string, userMessage: string): Promise<string> {
  const url = `${AZURE_ENDPOINT}/openai/deployments/${GPT_DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;
  
  console.log(`[tutor:gpt] Calling ${GPT_DEPLOYMENT}`, {
    userMessageLength: userMessage.length,
    timeout: '20s',
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_API_KEY,
      },
      signal: AbortSignal.timeout(20_000), // 20s — GPT-4o is faster than Whisper
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_completion_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'unknown');
      console.error(`[tutor:gpt] HTTP error ${res.status}`, {
        statusText: res.statusText,
        body: errorBody.substring(0, 200),
      });
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    let data;
    try {
      data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    } catch (parseErr) {
      console.error('[tutor:gpt] Failed to parse response JSON', { error: String(parseErr) });
      throw new Error('INVALID_JSON_RESPONSE');
    }

    // Validate response structure
    if (!data.choices || !Array.isArray(data.choices)) {
      console.error('[tutor:gpt] Invalid response structure: no choices array', { data });
      throw new Error('INVALID_RESPONSE_STRUCTURE');
    }

    const content = data.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      console.error('[tutor:gpt] Empty or invalid content in response', {
        hasChoices: !!data.choices,
        choiceCount: data.choices.length,
        firstChoiceHasMessage: !!data.choices[0]?.message,
      });
      throw new Error('EMPTY_RESPONSE_CONTENT');
    }

    console.log('[tutor:gpt] Response received successfully', {
      contentLength: content.length,
      hasJSON: content.includes('{'),
    });

    return content;
  } catch (err) {
    // Don't swallow the error — let the main handler classify it
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[tutor:gpt] Request timeout (20s exceeded)');
      throw new Error('TIMEOUT');
    }
    throw err;
  }
}

// ─── System Prompts ────────────────────────────────────────────────────

const CORRECTION_SYSTEM_PROMPT = `Du bist ein erfahrener Deutschtutor. Analysiere den Text des Schülers und antworte NUR mit diesem exakten JSON-Format (kein zusätzlicher Text):
{
  "original": "<der exakte Eingabetext>",
  "corrected": "<vollständig korrigierter deutscher Text>",
  "error_type": "<Fehlertyp oder null>",
  "error_category": "<Artikel|Wortstellung|Konjugation|Präposition|Kasus|Rechtschreibung|Vokabular|Zeitform>",
  "explanation_de": "<Erklärung auf Deutsch, natürlich und ermutigend>",
  "confidence": <0.0-1.0>,
  "cefr_estimate": "<A1|A2|B1|B2|C1|C2>",
  "new_vocabulary": [{"word": "<German word>", "translation": "<English>", "cefr": "<level>"}]
}

Fehlertypen: Nominativ/Akkusativ/Dativ-Fehler, Verb-Konjugation, Artikel-Fehler, Präposition falsch, Wortstellung, Rechtschreibung, Vokabular falsch, Zeitform falsch

Wichtig:
- explanation_de MUSS auf Deutsch sein, natürlich und ermutigend
- Confidence-Score basierend auf Sicherheit der Korrektur (0.8+ = sehr sicher)
- Wenn der Text bereits perfekt ist: error_type = null, error_category = null, confidence = 1.0
- Immer genau dieses JSON-Format, keine anderen Felder, kein zusätzlicher Text`;

const AUDIO_SYSTEM_PROMPT = `Du bist ein erfahrener Deutschtutor. Der Schüler sprach Deutsch (transkribiert von Audio). Einige Fehler könnten Transkriptionsfehler statt echte Sprechfehler sein. Analysiere und korrigiere den Text und antworte NUR mit diesem JSON-Format:
{
  "original": "<transkribierter Text>",
  "corrected": "<korrigiertes Deutsch>",
  "error_type": "<Fehlertyp oder null>",
  "error_category": "<Artikel|Wortstellung|Konjugation|Präposition|Kasus|Rechtschreibung|Vokabular|Zeitform>",
  "explanation_de": "<Erklärung auf Deutsch, erwähne Transkriptionsprobleme wenn relevant>",
  "confidence": <0.0-1.0>,
  "cefr_estimate": "<A1|A2|B1|B2|C1|C2>",
  "new_vocabulary": [{"word": "<word>", "translation": "<English>", "cefr": "<level>"}]
}

Wichtig: Immer dieses exakte JSON-Format verwenden.`;

function parseCorrectionResult(text: string, fallbackOriginal: string, isAudio = false): CorrectionResult {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Extract new German-response format fields
    const errorType = (parsed.error_type as string | null);
    const errorCategory = (parsed.error_category as string);
    const confidence = (parsed.confidence as number) ?? 0.85;
    let explanationDe = (parsed.explanation_de as string) || '';

    // Add pronunciation guidance for audio if confidence is low
    if (isAudio && confidence < 0.7) {
      explanationDe += `\n\n💡 **Aussprache-Tipp:** Höre dir die richtige Aussprache an und vergleiche mit deiner Aufnahme.`;
    }

    console.log('[tutor:parse] Parsed correction response:', {
      hasErrors: errorType !== null,
      errorCategory,
      confidence,
      cefr: parsed.cefr_estimate,
      pronunciationNote: isAudio && confidence < 0.7,
    });

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
  } catch (err) {
    console.error('[tutor:parse] Failed to parse correction response:', err);
    throw new Error('GPT_FAILED');
  }
}

// ─── Input Validation ──────────────────────────────────────────────────

function validateAudioInput(file: File): { valid: boolean; error?: string } {
  // Size limits
  const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB — Azure Whisper limit
  const MIN_AUDIO_BYTES = 100; // 100 bytes minimum (basically a header)

  if (file.size > MAX_AUDIO_BYTES) {
    return {
      valid: false,
      error: `Audio-Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum ist 25 MB.`
    };
  }

  if (file.size < MIN_AUDIO_BYTES) {
    return { valid: false, error: 'Audio-Datei ist zu klein oder beschädigt.' };
  }

  // MIME type validation
  const ALLOWED_TYPES = new Set([
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3',
    'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/aac',
    'audio/flac', 'audio/x-m4a',
  ]);
  const fileType = file.type?.toLowerCase() ?? '';
  
  if (fileType && !fileType.startsWith('audio/') && !ALLOWED_TYPES.has(fileType)) {
    return {
      valid: false,
      error: `Audio-Format nicht unterstützt. Verwenden Sie MP3, WAV, OGG, FLAC oder WebM.`
    };
  }

  // Rough duration estimate: assume ~128kbps bitrate average
  const estimatedSeconds = (file.size * 8) / (128 * 1024);
  const MAX_DURATION = 60 * 10; // 10 minutes max
  const MIN_DURATION = 1; // At least 1 second

  if (estimatedSeconds > MAX_DURATION) {
    return {
      valid: false,
      error: 'Audio-Datei ist zu lang (geschätzt über 10 Minuten). Bitte eine kürzere Aufnahme versuchen.'
    };
  }

  if (estimatedSeconds < MIN_DURATION && file.size > 500) {
    return {
      valid: false,
      error: 'Audio-Datei enthält zu wenig Audio-Daten. Bitte mindestens 1 Sekunde aufnehmen.'
    };
  }

  return { valid: true };
}

function validateTextInput(text: string): { valid: boolean; error?: string } {
  if (!text || !text.trim()) {
    return { valid: false, error: 'Bitte geben Sie einen Text ein.' };
  }

  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).length;

  if (wordCount < 3) {
    return { valid: false, error: 'Der Text sollte mindestens 3 Wörter enthalten.' };
  }

  // Basic German character detection (ä, ö, ü, ß, or other common patterns)
  const hasGermanChars = /[äöüßÄÖÜ]|sch|ch|st(?![aeiouäöüy])|qu|z/.test(trimmed);
  const hasLatinChars = /[a-zA-Z]/.test(trimmed);

  // Very permissive: accept if has any Latin chars (includes English)
  // More strict check could require German-specific patterns
  if (!hasLatinChars) {
    return { valid: false, error: 'Der Text sollte lateinische Zeichen enthalten.' };
  }

  return { valid: true };
}

// ─── Route Handler ────────────────────────────────────────────────────

export const POST = withApiGuard(
  async (req: NextRequest, ctx) => {
    const user = ctx.user!;
    const contentType = req.headers.get('content-type') ?? '';

    console.log(`[tutor] New request from user ${user.id}, contentType: ${contentType}`);

    if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
      return NextResponse.json(
        { error: 'Azure OpenAI is not configured. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.' },
        { status: 503 }
      );
    }

    const tomContext = await buildN8nContext(user.id).catch(() => ({
      native_language: 'English',
      cefr_level: 'B1',
      top_errors: [] as string[],
      student_belief: '',
      correction_count: 0,
      l1_prompt_note: '',
    }));

    try {
      let result: CorrectionResult;
      let workflow: string;

      if (contentType.includes('multipart/form-data')) {
        // AUDIO CORRECTION
        console.log('[tutor] Parsing multipart formdata for audio workflow');
        const formData = await req.formData();
        workflow = formData.get('workflow') as string;

        if (!workflow || !ALLOWED_WORKFLOWS.includes(workflow as Workflow)) {
          return NextResponse.json({ error: 'Invalid workflow' }, { status: 400 });
        }

        const audioFile = formData.get('audio') as File | null;
        if (!audioFile) {
          console.error('[tutor] No audio file in formdata');
          return NextResponse.json({ error: 'Bitte laden Sie eine Audio-Datei hoch.' }, { status: 400 });
        }

        // ── Comprehensive audio validation ─────────────────────────────────
        const audioValidation = validateAudioInput(audioFile);
        if (!audioValidation.valid) {
          console.log('[tutor] Audio validation failed:', audioValidation.error);
          return NextResponse.json({ error: audioValidation.error }, { status: 400 });
        }

        console.log('[tutor] Audio file received', { name: audioFile.name, size: audioFile.size, type: audioFile.type });

        const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type || 'audio/webm' });
        
        console.log('[tutor] Starting audio pipeline...');
        const pipelineStart = performance.now();
        
        const whisperStart = performance.now();
        const transcribed = await transcribeAudio(audioBlob, audioFile.name || 'audio.webm');
        const whisperDuration = performance.now() - whisperStart;
        console.log('[tutor:perf] Whisper transcription complete', { 
          duration_ms: Math.round(whisperDuration),
          transcribed_length: transcribed.length 
        });

        const gptStart = performance.now();
        const gptResponse = await callAzureGPT(
          AUDIO_SYSTEM_PROMPT,
          `Bitte korrigiere diese transkribierte deutsche Rede: ${transcribed}`
        );
        const gptDuration = performance.now() - gptStart;
        
        result = parseCorrectionResult(gptResponse, transcribed, true);
        
        const totalDuration = performance.now() - pipelineStart;
        console.log('[tutor:perf] Audio correction pipeline complete', {
          total_ms: Math.round(totalDuration),
          whisper_ms: Math.round(whisperDuration),
          gpt_ms: Math.round(gptDuration),
          confidence: result.confidence,
          has_errors: (result.error_categories?.length ?? 0) > 0,
        });

      } else {
        // TEXT OR OCR CORRECTION
        const pipelineStart = performance.now();
        console.log('[tutor] Parsing JSON request for text workflow');
        const body = await req.json() as Record<string, unknown>;
        workflow = body.workflow as string;

        if (!workflow || !ALLOWED_WORKFLOWS.includes(workflow as Workflow)) {
          return NextResponse.json({ error: 'Invalid workflow' }, { status: 400 });
        }

        let inputText = (workflow === 'ocr-correction'
          ? body.ocr_text
          : body.text) as string | undefined;

        // Validate text input
        const validation = validateTextInput(inputText || '');
        if (!validation.valid) {
          console.log('[tutor] Text validation failed:', validation.error);
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }
        
        // After validation, assert inputText is a string
        inputText = inputText as string;

        const systemPrompt = `${CORRECTION_SYSTEM_PROMPT}\n\nStudent context: Native language is ${tomContext.native_language}. Estimated level: ${tomContext.cefr_level}. Common errors: ${tomContext.top_errors.slice(0, 3).join(', ') || 'none yet'}.`;

        const prefix = workflow === 'ocr-correction'
          ? 'Bitte korrigiere diesen deutschen Text aus einem Foto/Scan'
          : 'Bitte korrigiere diesen deutschen Text';

        const gptStart = performance.now();
        const gptResponse = await callAzureGPT(systemPrompt, `${prefix}: ${inputText}`);
        const gptDuration = performance.now() - gptStart;

        result = parseCorrectionResult(gptResponse, inputText, workflow === 'audio-correction');

        const totalDuration = performance.now() - pipelineStart;
        console.log('[tutor:perf] Text/OCR correction pipeline complete', {
          workflow,
          total_ms: Math.round(totalDuration),
          gpt_ms: Math.round(gptDuration),
          inputLength: inputText.length,
          hasErrors: (result.error_categories?.length ?? 0) > 0,
        });
      }

      const wasCorrect = !result.error_categories || result.error_categories.length === 0;
      updateStudentModel(user.id, result, tomContext.native_language as string).catch(console.error);
      updateAccuracy(user.id, wasCorrect).catch(console.error);

      console.log('[tutor] Request completed successfully', {
        workflow,
        hasErrors: result.error_categories.length > 0,
        confidence: result.confidence,
        cefr: result.cefr_estimate,
      });
      
      // Add inputType based on workflow
      const inputType = workflow === 'audio-correction' 
        ? 'audio' 
        : workflow === 'ocr-correction' 
        ? 'image' 
        : 'text';
      
      return NextResponse.json({ ...result, inputType });

    } catch (err: any) {
      // Determine which service failed based on error message
      let errorSource: ErrorContext['source'] = 'unknown';
      if (err?.message?.includes('TRANSCRIPTION') || err?.message?.includes('audio')) {
        errorSource = 'whisper';
      } else if (err?.message?.includes('GPT') || err?.message?.includes('gpt')) {
        errorSource = 'gpt';
      } else if (err?.message?.includes('VALIDATION')) {
        errorSource = 'validation';
      } else if (err?.message?.includes('TIMEOUT')) {
        errorSource = 'timeout';
      }

      const { code, userMessage, logContext } = classifyError(err, errorSource);

      logger.error('tutor.request.failed', err, {
        errorCode: code,
        source: logContext.source,
        workflow: (contentType.includes('multipart') ? 'audio' : 'text/json'),
        userId: user.id,
      });

      // Map error codes to HTTP status codes
      const statusMap: Record<string, number> = {
        'TIMEOUT': 408,
        'RATE_LIMIT': 429,
        'AUTH_ERROR': 401,
        'SERVICE_ERROR': 503,
        'VALIDATION_ERROR': 400,
        'UNKNOWN_ERROR': 500,
      };
      const statusCode = statusMap[code] || 500;

      return NextResponse.json({ error: userMessage, errorCode: code }, { status: statusCode });
    }
  },
  {
    requireAuth: true,
    rateLimit: { requests: 60, window: 60 },
  }
);
