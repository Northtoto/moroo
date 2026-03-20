// ─── Tutor TTS (Text-to-Speech) API ────────────────────────────────────────
// POST { text } → audio/mpeg stream with German pronunciation
// Uses Azure Speech TTS service for natural German speech synthesis
// Returns: audio/mpeg stream (MP3 audio data)

import { NextRequest, NextResponse } from 'next/server';
import { withApiGuard } from '@/lib/api-guard';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const TTSSchema = z.object({
  text: z.string().min(1).max(500),
  voice: z.enum(['Katja', 'Conrad', 'Amala']).default('Katja'),
});

const AZURE_SPEECH_KEY = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY ?? '';
const AZURE_SPEECH_REGION = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION ?? 'eastus';

// Voice mapping to Azure Neural voices
const VOICE_MAP = {
  Katja: 'de-DE-KatjaNeural',      // Female, warm and friendly
  Conrad: 'de-DE-ConradNeural',    // Male, natural
  Amala: 'de-DE-AmalaNeural',      // Female, natural
} as const;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const POST = withApiGuard(
  async (req: NextRequest, ctx) => {
    const user = ctx.user!;
    const { text, voice } = ctx.validatedBody as z.infer<typeof TTSSchema>;

    console.log('[tutor:tts] New TTS request', {
      userId: user.id,
      textLength: text.length,
      voice,
    });

    if (!AZURE_SPEECH_KEY) {
      logger.error('tts.azure_speech_not_configured');
      return NextResponse.json(
        { error: 'Text-to-speech service not configured' },
        { status: 503 }
      );
    }

    try {
      // Build SSML with German language and selected voice
      const voiceName = VOICE_MAP[voice];
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='de-DE'>
        <voice name='${voiceName}'>
          <prosody rate='0.95'>${escapeXml(text)}</prosody>
        </voice>
      </speak>`;

      // Azure Speech TTS REST API endpoint
      const endpoint = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

      console.log('[tutor:tts] Calling Azure TTS', {
        endpoint,
        voiceName,
        textLength: text.length,
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
        },
        body: ssml,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error('tts.azure_error', undefined, { status: response.status, error: errorText });
        return NextResponse.json(
          { error: 'Text-to-speech synthesis failed' },
          { status: 502 }
        );
      }

      const audioBuffer = await response.arrayBuffer();

      console.log('[tutor:tts] TTS synthesis complete', {
        audioSize: audioBuffer.byteLength,
        voice,
      });

      // Return audio stream as MP3
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'private, max-age=86400',
          'Content-Disposition': 'inline',
        },
      });
    } catch (err) {
      logger.error('tts.synthesis_failed', err, { userId: user.id, textLength: text.length });
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        { error: `Text-to-speech failed: ${message}` },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: true,
    rateLimit: { requests: 30, window: 60 },
    bodySchema: TTSSchema,
  }
);
