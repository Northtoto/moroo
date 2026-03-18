// ─── Pronunciation Assessment API ────────────────────────────────────────────
// POST { spokenText, referenceText } → phoneme-level accuracy scores
// Uses Azure Speech SDK (server-side) for PronunciationAssessmentConfig
// Returns: { accuracyScore, fluencyScore, completenessScore, pronunciationScore, phonemes[] }

import { NextRequest, NextResponse } from 'next/server';
import { withApiGuard } from '@/lib/api-guard';
import { z } from 'zod';

const AssessSchema = z.object({
  spokenText: z.string().min(1).max(500),
  referenceText: z.string().min(1).max(500),
});

export const POST = withApiGuard(
  async (req: NextRequest, ctx) => {
    const { spokenText, referenceText } = ctx.validatedBody as z.infer<typeof AssessSchema>;

    const speechKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
    const speechRegion = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION ?? 'eastus';

    if (!speechKey) {
      return NextResponse.json({ error: 'Speech service not configured' }, { status: 503 });
    }

    try {
      // Azure Speech REST API for pronunciation assessment
      // POST to speech/recognition/conversation/cognitiveservices/v1
      // with Pronunciation-Assessment header
      const assessmentConfig = JSON.stringify({
        ReferenceText: referenceText,
        GradingSystem: 'HundredMark',
        Granularity: 'Phoneme',
        EnableMiscue: true,
      });

      const assessmentHeader = Buffer.from(assessmentConfig).toString('base64');

      // Build SSML body with the spoken text
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='de-DE'>
        <voice name='de-DE-KatjaNeural'>${escapeXml(spokenText)}</voice>
      </speak>`;

      const endpoint = `https://${speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=de-DE&format=detailed`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': speechKey,
          'Content-Type': 'application/ssml+xml',
          'Pronunciation-Assessment': assessmentHeader,
          'Accept': 'application/json',
        },
        body: ssml,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.error('[pronunciation] Azure error:', response.status, await response.text());
        return NextResponse.json({ error: 'Assessment failed' }, { status: 502 });
      }

      const data = await response.json() as AzurePronunciationResponse;
      return NextResponse.json(transformResponse(data));
    } catch (err) {
      console.error('[pronunciation] error:', err);
      return NextResponse.json({ error: 'Assessment failed' }, { status: 500 });
    }
  },
  {
    requireAuth: true,
    rateLimit: { requests: 20, window: 60 },
    bodySchema: AssessSchema,
  }
);

// ─── Azure response types ─────────────────────────────────────────────────────

interface AzurePhoneme {
  Phoneme: string;
  PronunciationAssessment: { AccuracyScore: number };
}

interface AzureWord {
  Word: string;
  Phonemes?: AzurePhoneme[];
  PronunciationAssessment?: {
    AccuracyScore: number;
    ErrorType: string;
  };
}

interface AzurePronunciationResponse {
  NBest?: Array<{
    PronunciationAssessment?: {
      AccuracyScore: number;
      FluencyScore: number;
      CompletenessScore: number;
      PronScore: number;
    };
    Words?: AzureWord[];
  }>;
}

function transformResponse(data: AzurePronunciationResponse) {
  const best = data.NBest?.[0];
  const pa = best?.PronunciationAssessment;

  const phonemes: Array<{ phoneme: string; accuracyScore: number }> = [];
  for (const word of best?.Words ?? []) {
    for (const ph of word.Phonemes ?? []) {
      phonemes.push({
        phoneme: ph.Phoneme,
        accuracyScore: Math.round(ph.PronunciationAssessment.AccuracyScore),
      });
    }
  }

  return {
    accuracyScore: Math.round(pa?.AccuracyScore ?? 0),
    fluencyScore: Math.round(pa?.FluencyScore ?? 0),
    completenessScore: Math.round(pa?.CompletenessScore ?? 0),
    pronunciationScore: Math.round(pa?.PronScore ?? 0),
    phonemes,
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
