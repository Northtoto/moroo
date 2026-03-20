'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import CorrectionDisplay from '@/components/correction/CorrectionDisplay';
import AudioRecorder from '@/components/tutor/AudioRecorder';
import ImageUploader from '@/components/tutor/ImageUploader';
import DictionarySearch from '@/components/tutor/DictionarySearch';
import MobileStatsDrawer from '@/components/tutor/MobileStatsDrawer';
import type { CorrectionResult } from '@/types';
import toast from 'react-hot-toast';

type Tab = 'text' | 'audio' | 'image';

interface SessionStats {
  today: number;
  accuracy: number;
}

interface ErrorPattern {
  category: string;
  count: number;
}

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode; xp: number }[] = [
  {
    key: 'text',
    label: 'Text',
    xp: 10,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    key: 'audio',
    label: 'Audio',
    xp: 20,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    key: 'image',
    label: 'OCR',
    xp: 15,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function TutorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<(CorrectionResult & { inputType: 'text' | 'audio' | 'image' })[]>([]);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFilename, setAudioFilename] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [stats, setStats] = useState<SessionStats>({ today: 0, accuracy: 100 });
  const [errorPatterns, setErrorPatterns] = useState<ErrorPattern[]>([]);
  const [charCount, setCharCount] = useState(0);

  // Tab indicator
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('tutor_sessions')
        .insert({ user_id: user.id })
        .select('id')
        .single()
        .then(({ data }) => { if (data) setSessionId(data.id); });
    });
  }, []);

  // Update tab indicator on tab change
  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const idx = TAB_CONFIG.findIndex((t) => t.key === activeTab);
    const tab = container.children[idx] as HTMLElement;
    if (tab) {
      setIndicatorStyle({ left: tab.offsetLeft, width: tab.offsetWidth });
    }
  }, [activeTab]);

  const submitCorrection = useCallback(
    async (workflow: string, data: Record<string, unknown> | FormData) => {
      setLoading(true);
      setError('');
      try {
        const isFormData = data instanceof FormData;
        const res = await fetch('/api/tutor', {
          method: 'POST',
          ...(isFormData
            ? { body: data }
            : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflow, ...data }) }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Anfrage fehlgeschlagen' }));
          throw new Error(err.error || 'Anfrage fehlgeschlagen');
        }

        const result: CorrectionResult = await res.json();
        if (!result.original || !result.corrected) {
          throw new Error('Ungültige Antwort vom Server erhalten. Bitte erneut versuchen.');
        }
        const inputType: 'text' | 'audio' | 'image' =
          workflow === 'audio-correction' ? 'audio'
          : workflow === 'ocr-correction' ? 'image'
          : 'text';

        setResults((prev) => [{ ...result, inputType }, ...prev]);

        // Update session stats
        setStats((prev) => {
          const wasCorrect = result.original.trim().toLowerCase() === result.corrected.trim().toLowerCase();
          const newToday = prev.today + 1;
          const newAccuracy = Math.round(((prev.accuracy * prev.today) + (wasCorrect ? 100 : 0)) / newToday);
          return { today: newToday, accuracy: newAccuracy };
        });

        // Accumulate error patterns (mock — in prod, parse from result.explanation)
        setErrorPatterns((prev) => {
          const cats = ['Artikel', 'Wortstellung', 'Konjugation', 'Präposition', 'Kasus'];
          const pick = cats[Math.floor(Math.random() * cats.length)];
          const existing = prev.find((p) => p.category === pick);
          if (existing) {
            return prev.map((p) => p.category === pick ? { ...p, count: p.count + 1 } : p)
              .sort((a, b) => b.count - a.count).slice(0, 5);
          }
          return [...prev, { category: pick, count: 1 }].sort((a, b) => b.count - a.count).slice(0, 5);
        });

        toast.success(`+${TAB_CONFIG.find(t => t.key === inputType)?.xp ?? 10} XP verdient!`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Etwas ist schief gelaufen';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    submitCorrection('text-correction', { text: textInput });
    setTextInput('');
    setCharCount(0);
  };

  const handleAudioSubmit = () => {
    if (!audioBlob) return;
    if (!sessionId) { toast.error('Session nicht bereit. Bitte warte einen Moment.'); return; }
    const fd = new FormData();
    fd.append('audio', audioBlob, audioFilename);
    fd.append('workflow', 'audio-correction');
    fd.append('session_id', sessionId);
    submitCorrection('audio-correction', fd);
    setAudioBlob(null);
  };

  const handleImageSubmit = () => {
    if (!ocrText.trim()) return;
    submitCorrection('ocr-correction', { ocr_text: ocrText });
    setOcrText('');
  };

  const topErrors = errorPatterns.slice(0, 3);
  const maxErrCount = topErrors[0]?.count ?? 1;

  return (
    <div className="flex h-screen overflow-hidden flex-col lg:flex-row">
      {/* ── CENTER ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-0 shrink-0">
          <h1
            className="text-xl sm:text-2xl font-bold mb-1 animate-fade-up"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            KI-Tutor
          </h1>
          <p className="text-xs sm:text-sm animate-fade-up" style={{ color: 'var(--text-muted)', animationDelay: '50ms' }}>
            Reiche dein Deutsch ein — erhalte sofortige Korrektur und Erklärung.
          </p>
        </div>

        {/* Mode tabs */}
        <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 shrink-0">
          <div
            className="relative inline-flex rounded-xl p-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}
          >
            <div ref={tabsRef} className="flex">
              {TAB_CONFIG.map((tab, idx) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="relative flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    color: activeTab === tab.key ? 'var(--amber)' : 'var(--text-muted)',
                    animationDelay: `${idx * 50}ms`,
                    fontFamily: 'var(--font-display)',
                  }}
                  aria-pressed={activeTab === tab.key}
                >
                  {tab.icon}
                  {tab.label}
                  <span
                    className="text-xs rounded-full px-1.5"
                    style={{
                      background: 'var(--amber-glow)',
                      color: 'var(--amber)',
                      fontSize: '10px',
                    }}
                  >
                    +{tab.xp}
                  </span>
                </button>
              ))}
            </div>
            {/* Sliding indicator */}
            <span
              className="tab-indicator"
              style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
            />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
          {/* Input card */}
          <div
            className="rounded-2xl p-6 animate-fade-up"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', animationDelay: '100ms' }}
          >
            {/* TEXT MODE */}
            {activeTab === 'text' && (
              <form onSubmit={handleTextSubmit} className="space-y-4">
                <div className="relative">
                  <textarea
                    value={textInput}
                    onChange={(e) => { setTextInput(e.target.value); setCharCount(e.target.value.length); }}
                    placeholder="Schreib deinen deutschen Text hier... z.B. 'Ich bin gestern in Schule gegangen.'"
                    rows={typeof window !== 'undefined' && window.innerWidth < 768 ? 4 : 6}
                    maxLength={2000}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl text-sm sm:text-base resize-none transition-all"
                    style={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)',
                      lineHeight: '1.7',
                    }}
                    aria-label="Deutschen Text eingeben"
                  />
                  <div
                    className="absolute bottom-3 right-3 text-xs"
                    style={{ color: charCount > 1800 ? 'var(--danger)' : 'var(--text-muted)' }}
                  >
                    {charCount}/2000
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                  <button
                    type="submit"
                    disabled={loading || !textInput.trim()}
                    className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-2.5 h-12 sm:h-auto rounded-xl text-sm sm:text-sm font-semibold transition-all animate-pulse-glow flex-1 sm:flex-none justify-center sm:justify-start"
                    style={{
                      background: loading || !textInput.trim() ? 'rgba(245,158,11,0.3)' : 'var(--amber)',
                      color: '#0a0c12',
                      fontFamily: 'var(--font-display)',
                      cursor: loading || !textInput.trim() ? 'not-allowed' : 'pointer',
                    }}
                    aria-label="Text korrigieren"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Analysiert…
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Korrigieren
                      </>
                    )}
                  </button>
                  {textInput && !loading && (
                    <button
                      type="button"
                      onClick={() => { setTextInput(''); setCharCount(0); }}
                      className="px-3 py-2.5 rounded-xl text-xs transition-colors hover:bg-white/10"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Löschen
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* AUDIO MODE */}
            {activeTab === 'audio' && (
              <div className="space-y-5">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Nimm dich beim Deutschen sprechen auf — wir transkribieren und korrigieren es.
                </p>
                <AudioRecorder
                  onAudioReady={(blob, filename) => { setAudioBlob(blob); setAudioFilename(filename); }}
                  disabled={loading}
                />
                {audioBlob && (
                  <button
                    onClick={handleAudioSubmit}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-2.5 h-12 sm:h-auto rounded-xl text-sm font-semibold transition-all animate-pulse-glow w-full sm:w-auto justify-center"
                    style={{
                      background: loading ? 'rgba(245,158,11,0.3)' : 'var(--amber)',
                      color: '#0a0c12',
                      fontFamily: 'var(--font-display)',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? (
                      <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Verarbeitet…</>
                    ) : (
                      <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Senden</>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* OCR MODE */}
            {activeTab === 'image' && (
              <div className="space-y-5">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Lade ein Foto deiner Hausaufgaben hoch — wir lesen und korrigieren den Text.
                </p>
                <ImageUploader onTextExtracted={setOcrText} disabled={loading} />
                {ocrText && (
                  <button
                    onClick={handleImageSubmit}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all animate-pulse-glow"
                    style={{
                      background: loading ? 'rgba(245,158,11,0.3)' : 'var(--amber)',
                      color: '#0a0c12',
                      fontFamily: 'var(--font-display)',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? (
                      <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Verarbeitet…</>
                    ) : (
                      <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Korrigieren</>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Error state */}
          {error && (
            <div
              className="rounded-2xl p-4 animate-slide-down"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}
            >
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0" style={{ color: 'var(--danger)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div
              className="rounded-2xl p-6 space-y-3 animate-fade-up"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}
            >
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-5/6" />
              <div className="skeleton h-4 w-2/3" />
              <p className="text-xs text-center pt-2 animate-pulse" style={{ color: 'var(--text-muted)' }}>
                Dein Deutsch wird analysiert…
              </p>
            </div>
          )}

          {/* Results */}
          {results.map((result, i) => (
            <div key={i} style={{ animationDelay: `${i * 50}ms` }}>
              <CorrectionDisplay
                original={result.original}
                corrected={result.corrected}
                explanation_de={result.explanation_de}
                error_type={result.error_type}
                confidence={result.confidence}
                error_categories={result.error_categories}
                new_vocabulary={result.new_vocabulary}
                cefr_estimate={result.cefr_estimate}
                transcription={result.transcription}
                inputType={result.inputType}
                xpEarned={
                  result.inputType === 'audio' ? 20 : result.inputType === 'image' ? 15 : 10
                }
              />
            </div>
          ))}

          {/* Empty state */}
          {results.length === 0 && !loading && (
            <div
              className="rounded-2xl p-8 text-center animate-fade-up"
              style={{
                background: 'var(--glass-bg)',
                border: '1px dashed var(--glass-border)',
                animationDelay: '200ms',
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--amber-glow)', border: '1px solid rgba(245,158,11,0.20)' }}
              >
                <span className="text-2xl">🇩🇪</span>
              </div>
              <p className="text-sm font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                Bereit zum Lernen?
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Schreibe deinen ersten deutschen Satz oben ein.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <aside
        className="shrink-0 hidden lg:flex flex-col overflow-y-auto"
        style={{
          width: '280px',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--glass-border)',
          padding: '24px 16px',
          gap: '16px',
        }}
      >
        {/* Session stats */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
            Session
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--amber)' }}>
                {stats.today}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Korrekturen</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--success)' }}>
                {stats.accuracy}%
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Genauigkeit</p>
            </div>
          </div>
        </div>

        {/* Mistake patterns */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
            Fehlermuster
          </p>
          {topErrors.length === 0 ? (
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            >
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Noch keine Korrekturen
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topErrors.map((err, i) => (
                <div key={err.category} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{err.category}</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                      ×{err.count}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(err.count / maxErrCount) * 100}%`,
                        background: i === 0
                          ? 'linear-gradient(90deg, var(--danger), #f87171)'
                          : i === 1
                          ? 'linear-gradient(90deg, var(--amber), #fbbf24)'
                          : 'linear-gradient(90deg, var(--ice), #93c5fd)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dictionary search */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}
        >
          <DictionarySearch />
        </div>

        {/* Adaptive exercise */}
        {topErrors.length > 0 && (
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--amber-glow)', border: '1px solid rgba(245,158,11,0.20)' }}
          >
            <p
              className="text-xs font-bold mb-2"
              style={{ color: 'var(--amber)', fontFamily: 'var(--font-display)' }}
            >
              ⚡ Übung für dich
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              Basierend auf deinen Fehlern bei{' '}
              <strong style={{ color: 'var(--amber)' }}>{topErrors[0]?.category}</strong>:
            </p>
            <p
              className="text-xs mt-2 italic"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              „Ich gehe ___ Schule jeden Morgen."
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              (in die / zur / zum / ?)
            </p>
          </div>
        )}

        {/* Provider badge */}
        <div
          className="mt-auto rounded-xl p-3 flex items-center gap-2.5"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
            style={{ background: 'rgba(0,120,212,0.2)', border: '1px solid rgba(0,120,212,0.3)' }}
          >
            ⚡
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Azure OpenAI</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>GPT-4o · Aktiv</p>
          </div>
          <div className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
        </div>
      </aside>

      {/* Mobile stats drawer - visible on mobile, hidden on lg screens */}
      <MobileStatsDrawer
        correctionsToday={stats.today}
        accuracy={stats.accuracy}
        errorPatterns={errorPatterns}
      />
    </div>
  );
}
