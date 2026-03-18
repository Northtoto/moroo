'use client';

// ─── useGermanSpeech ──────────────────────────────────────────────────────────
// Wraps react-speech-recognition for German STT with Azure Cognitive Services.
// Auto-submits after a configurable silence window.
// Pronunciation assessment scores returned after each recording session.

import { useEffect, useRef, useState, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

export interface PhonemeScore {
  phoneme: string;
  accuracyScore: number;
}

export interface PronunciationScore {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  pronunciationScore: number;
  phonemes: PhonemeScore[];
}

export interface UseGermanSpeechOptions {
  silenceMs?: number;           // ms of silence before auto-submit (default: 2000)
  onSubmit?: (transcript: string) => void;
  referenceText?: string;       // for pronunciation assessment
}

export interface UseGermanSpeechReturn {
  transcript: string;
  interimTranscript: string;
  listening: boolean;
  browserSupportsSpeechRecognition: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  pronunciationScore: PronunciationScore | null;
  phonemeScores: PhonemeScore[];
  isAssessing: boolean;
}

// ─── Azure polyfill bootstrap ─────────────────────────────────────────────────
// Must be called once in browser context before first startListening.
// Uses web-speech-cognitive-services to swap in Azure Cognitive Services
// instead of the browser's native SpeechRecognition API.

let azurePolyfillApplied = false;

async function applyAzurePolyfill(): Promise<void> {
  if (azurePolyfillApplied || typeof window === 'undefined') return;

  const azureKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
  const azureRegion = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;

  if (!azureKey || !azureRegion) {
    // Fall back to browser native — still works for most desktop browsers
    console.warn('[useGermanSpeech] Azure Speech keys not configured, using browser native STT');
    azurePolyfillApplied = true;
    return;
  }

  try {
    const { createSpeechServicesPonyfill } = await import('web-speech-cognitive-services');
    const { SpeechRecognition: AzureSpeechRecognition } = createSpeechServicesPonyfill({
      credentials: { region: azureRegion, subscriptionKey: azureKey },
    });
    SpeechRecognition.applyPolyfill(AzureSpeechRecognition);
    azurePolyfillApplied = true;
  } catch (err) {
    console.warn('[useGermanSpeech] Azure polyfill failed, using native:', err);
    azurePolyfillApplied = true;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGermanSpeech({
  silenceMs = 2000,
  onSubmit,
  referenceText,
}: UseGermanSpeechOptions = {}): UseGermanSpeechReturn {
  const {
    transcript,
    interimTranscript,
    finalTranscript,
    listening,
    browserSupportsSpeechRecognition,
    resetTranscript,
  } = useSpeechRecognition();

  const [pronunciationScore, setPronunciationScore] = useState<PronunciationScore | null>(null);
  const [phonemeScores, setPhonemeScores] = useState<PhonemeScore[]>([]);
  const [isAssessing, setIsAssessing] = useState(false);

  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFinalRef = useRef('');

  // Apply Azure polyfill on mount
  useEffect(() => {
    applyAzurePolyfill();
  }, []);

  // ── Auto-submit on silence ──────────────────────────────────────────────────
  // When finalTranscript changes and interimTranscript is empty, the user
  // has stopped speaking. Wait silenceMs then auto-submit.
  useEffect(() => {
    if (!finalTranscript || finalTranscript === lastFinalRef.current) return;
    if (interimTranscript) return; // still speaking

    if (silenceTimer.current) clearTimeout(silenceTimer.current);

    silenceTimer.current = setTimeout(async () => {
      lastFinalRef.current = finalTranscript;

      // IMPORTANT: use abortListening with Azure + continuous mode
      // stopListening hangs waiting for a final result that never arrives
      await SpeechRecognition.abortListening();

      if (referenceText && finalTranscript) {
        await assessPronunciation(finalTranscript, referenceText);
      }

      onSubmit?.(finalTranscript);
    }, silenceMs);

    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, [finalTranscript, interimTranscript, silenceMs, onSubmit, referenceText]);

  // ── Pronunciation assessment (Azure REST API) ───────────────────────────────
  const assessPronunciation = useCallback(async (
    spokenText: string,
    reference: string
  ): Promise<void> => {
    const azureKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
    const azureRegion = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;
    if (!azureKey || !azureRegion) return;

    setIsAssessing(true);
    try {
      const res = await fetch('/api/pronunciation/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spokenText, referenceText: reference }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json() as PronunciationScore;
        setPronunciationScore(data);
        setPhonemeScores(data.phonemes ?? []);
      }
    } catch (err) {
      console.warn('[useGermanSpeech] pronunciation assessment failed:', err);
    } finally {
      setIsAssessing(false);
    }
  }, []);

  // ── Public controls ─────────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    lastFinalRef.current = '';
    setPronunciationScore(null);
    setPhonemeScores([]);
    resetTranscript();
    SpeechRecognition.startListening({
      continuous: true,
      language: 'de-DE',
    });
  }, [resetTranscript]);

  const stopListening = useCallback(async () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    // abortListening is safer than stopListening with Azure continuous mode
    await SpeechRecognition.abortListening();
  }, []);

  const handleResetTranscript = useCallback(() => {
    lastFinalRef.current = '';
    setPronunciationScore(null);
    setPhonemeScores([]);
    resetTranscript();
  }, [resetTranscript]);

  return {
    transcript,
    interimTranscript,
    listening,
    browserSupportsSpeechRecognition,
    startListening,
    stopListening,
    resetTranscript: handleResetTranscript,
    pronunciationScore,
    phonemeScores,
    isAssessing,
  };
}
