'use client';

import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import CorrectionDisplay from '@/components/correction/CorrectionDisplay';
import AudioRecorder from '@/components/tutor/AudioRecorder';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { CorrectionResult } from '@/types';

// Lazy-load the heavy OCR component only when the image tab is active
const ImageUploader = dynamic(() => import('@/components/tutor/ImageUploader'), {
  loading: () => (
    <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
      Loading OCR engine…
    </div>
  ),
  ssr: false,
});

type Tab = 'text' | 'audio' | 'image';

export default function TutorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CorrectionResult[]>([]);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Audio state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFilename, setAudioFilename] = useState('');

  // Image OCR state
  const [ocrText, setOcrText] = useState('');

  // Ref for textarea to enable keyboard shortcut
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('tutor_sessions')
        .insert({ user_id: user.id })
        .select('id')
        .single()
        .then(({ data }) => {
          if (data) setSessionId(data.id);
        });
    });
  }, []);

  const submitCorrection = useCallback(async (workflow: string, data: Record<string, unknown> | FormData) => {
    setLoading(true);
    setError('');
    try {
      const isFormData = data instanceof FormData;
      const res = await fetch('/api/tutor', {
        method: 'POST',
        ...(isFormData
          ? { body: data }
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workflow, ...data }),
            }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }

      const result: CorrectionResult = await res.json();
      const inputType: 'text' | 'audio' | 'image' =
        workflow === 'audio-correction' ? 'audio'
        : workflow === 'ocr-correction' ? 'image'
        : 'text';
      setResults((prev) => [{ ...result, inputType }, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTextSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!textInput.trim() || loading) return;
    submitCorrection('text-correction', { text: textInput });
    setTextInput('');
  }, [textInput, loading, submitCorrection]);

  // Ctrl/Cmd + Enter shortcut in textarea
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleTextSubmit();
    }
  }, [handleTextSubmit]);

  const handleAudioSubmit = () => {
    if (!audioBlob) return;
    if (!sessionId) {
      setError('Session not ready. Please wait a moment and try again.');
      return;
    }
    const formData = new FormData();
    formData.append('audio', audioBlob, audioFilename);
    formData.append('workflow', 'audio-correction');
    formData.append('session_id', sessionId);
    submitCorrection('audio-correction', formData);
    setAudioBlob(null);
  };

  const handleImageSubmit = () => {
    if (!ocrText.trim()) return;
    submitCorrection('ocr-correction', { ocr_text: ocrText });
    setOcrText('');
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'text',
      label: 'Text',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      key: 'audio',
      label: 'Audio',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      key: 'image',
      label: 'Image',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Tutor</h1>
        <p className="text-slate-400 mt-1">
          Submit your German text, audio, or image for instant correction and feedback.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        {/* Text Tab */}
        {activeTab === 'text' && (
          <form onSubmit={handleTextSubmit} className="space-y-4">
            <textarea
              ref={textareaRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Schreiben Sie Ihren deutschen Text hier… (Write your German text here…)"
              rows={5}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || !textInput.trim()}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                {loading ? 'Checking...' : 'Check My German'}
              </button>
              <span className="text-slate-600 text-xs hidden sm:block">
                or press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-slate-400">Ctrl</kbd>+<kbd className="bg-white/10 px-1.5 py-0.5 rounded text-slate-400">Enter</kbd>
              </span>
            </div>
          </form>
        )}

        {/* Audio Tab */}
        {activeTab === 'audio' && (
          <ErrorBoundary>
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">
                Record yourself speaking German or upload an audio file. We&apos;ll transcribe and correct it.
              </p>
              <AudioRecorder
                onAudioReady={(blob, filename) => {
                  setAudioBlob(blob);
                  setAudioFilename(filename);
                }}
                disabled={loading}
              />
              {audioBlob && (
                <button
                  onClick={handleAudioSubmit}
                  disabled={loading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  {loading ? 'Processing...' : 'Submit for Correction'}
                </button>
              )}
            </div>
          </ErrorBoundary>
        )}

        {/* Image Tab — lazy loaded */}
        {activeTab === 'image' && (
          <ErrorBoundary>
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">
                Upload a photo of your German homework or handwriting. We&apos;ll extract and correct the text.
              </p>
              <ImageUploader
                onTextExtracted={setOcrText}
                disabled={loading}
              />
              {ocrText && (
                <button
                  onClick={handleImageSubmit}
                  disabled={loading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  {loading ? 'Processing...' : 'Submit for Correction'}
                </button>
              )}
            </div>
          </ErrorBoundary>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white/5 rounded-xl p-8 border border-white/10 text-center">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 mt-3 text-sm">Analyzing your German…</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Corrections</h2>
          {results.map((result, i) => (
            <ErrorBoundary key={i}>
              <CorrectionDisplay
                original={result.original}
                corrected={result.corrected}
                explanation={result.explanation}
                transcription={result.transcription}
                inputType={result.inputType ?? 'text'}
              />
            </ErrorBoundary>
          ))}
        </div>
      )}
    </div>
  );
}
