'use client';

import { useCallback, useState, useEffect, useRef } from 'react';

interface CorrectionDisplayProps {
  original: string;
  corrected: string;
  explanation_de?: string;
  error_type?: string | null;
  confidence?: number;
  error_categories?: string[];
  new_vocabulary?: Array<{ word: string; translation: string; cefr: string }>;
  cefr_estimate?: string;
  transcription?: string;
  inputType: 'text' | 'audio' | 'image';
  xpEarned?: number;
}

interface DiffToken {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}

function computeDiff(original: string, corrected: string): DiffToken[] {
  const origWords = original.trim().split(/\s+/);
  const corrWords = corrected.trim().split(/\s+/);
  const result: DiffToken[] = [];

  // Simple LCS-based diff
  const m = origWords.length;
  const n = corrWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origWords[i - 1].toLowerCase() === corrWords[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  let i = m, j = n;
  const ops: Array<{ type: 'unchanged' | 'removed' | 'added'; text: string }> = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1].toLowerCase() === corrWords[j - 1].toLowerCase()) {
      ops.unshift({ type: 'unchanged', text: corrWords[j - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'added', text: corrWords[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'removed', text: origWords[i - 1] });
      i--;
    }
  }
  return ops;
}

function TypewriterText({ text, startDelay = 0 }: { text: string; startDelay?: number }) {
  const chars = text.split('');
  return (
    <>
      {chars.map((char, idx) => (
        <span
          key={idx}
          className="char-type"
          style={{ animationDelay: `${startDelay + idx * 40}ms` }}
        >
          {char}
        </span>
      ))}
    </>
  );
}

function XpBurst({ xp, onDone }: { xp: number; onDone: () => void }) {
  return (
    <span
      className="animate-xp-float absolute text-sm font-bold pointer-events-none select-none"
      style={{
        color: 'var(--amber)',
        textShadow: '0 0 12px rgba(245,158,11,0.8)',
        fontFamily: 'var(--font-display)',
        top: '-20px',
        right: '12px',
        zIndex: 20,
      }}
      onAnimationEnd={onDone}
    >
      +{xp} XP
    </span>
  );
}

export default function CorrectionDisplay({
  original,
  corrected,
  explanation_de,
  error_type,
  confidence,
  error_categories,
  new_vocabulary,
  cefr_estimate,
  transcription,
  inputType,
  xpEarned = 10,
}: CorrectionDisplayProps) {
  const [showDiff, setShowDiff] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showXp, setShowXp] = useState(false);
  const [xpVisible, setXpVisible] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const diff = computeDiff(original, corrected);
  const isCorrect = original.trim().toLowerCase() === corrected.trim().toLowerCase();

  // Count chars for total typewriter duration
  const addedChars = diff
    .filter((t) => t.type === 'added')
    .reduce((sum, t) => sum + t.text.length, 0);
  const typewriterDuration = addedChars * 40;

  useEffect(() => {
    // Sequence: diff → explanation → xp
    const t1 = setTimeout(() => setShowDiff(true), 100);
    const t2 = setTimeout(() => setShowExplanation(true), 200 + typewriterDuration);
    const t3 = setTimeout(() => {
      setShowXp(true);
      setXpVisible(true);
    }, 400 + typewriterDuration);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [typewriterDuration]);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9; // Slightly slower for learners
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }, []);

  // Build typewriter with delays across words
  let charOffset = 0;

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden animate-fade-up"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}
    >
      {/* XP burst */}
      {xpVisible && showXp && (
        <XpBurst xp={xpEarned} onDone={() => setXpVisible(false)} />
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--glass-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">
            {inputType === 'audio' ? '🎙️' : inputType === 'image' ? '📸' : '✏️'}
          </span>
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            {isCorrect ? 'Perfekt! Keine Fehler' : 'Korrektur'}
          </span>
          {isCorrect && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              +25 XP Bonus
            </span>
          )}
          {confidence !== undefined && !isCorrect && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: confidence > 0.8 ? 'rgba(34,197,94,0.15)' : confidence > 0.6 ? 'rgba(251,146,60,0.15)' : 'rgba(239,68,68,0.15)',
                color: confidence > 0.8 ? '#22c55e' : confidence > 0.6 ? '#fb923c' : '#ef4444',
                border: confidence > 0.8 ? '1px solid rgba(34,197,94,0.25)' : confidence > 0.6 ? '1px solid rgba(251,146,60,0.25)' : '1px solid rgba(239,68,68,0.25)',
              }}
            >
              {confidence > 0.8 ? '✓ Sicher' : confidence > 0.6 ? '⚠ Moderat' : '? Unsicher'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => speak(corrected)}
          className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Vorlesefunktion"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6a9 9 0 010 12M8.464 8.464a5 5 0 000 7.072" />
          </svg>
          Anhören
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Transcription */}
        {transcription && (
          <div className="rounded-xl p-4 animate-slide-down" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              {inputType === 'audio' ? 'Transkription' : 'OCR-Text'}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{transcription}</p>
          </div>
        )}

        {/* Diff view */}
        {showDiff && (
          <div className="rounded-xl p-4 animate-slide-up" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Diff-Ansicht
            </p>
            <div className="text-sm leading-loose" style={{ fontFamily: 'var(--font-mono)' }}>
              {diff.map((token, idx) => {
                if (token.type === 'unchanged') {
                  return <span key={idx} style={{ color: 'var(--text-primary)' }}>{token.text} </span>;
                }
                if (token.type === 'removed') {
                  return <span key={idx} className="word-removed">{token.text} </span>;
                }
                // added — typewriter
                const currentOffset = charOffset;
                charOffset += token.text.length + 1;
                return (
                  <span key={idx} className="word-added">
                    <TypewriterText text={token.text + ' '} startDelay={currentOffset * 40} />
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Type */}
        {showExplanation && error_type && !isCorrect && (
          <div className="rounded-xl p-4 animate-slide-up" style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.15)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,193,7,0.8)' }}>
              ⚠️ Fehlertyp
            </p>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{error_type}</p>
          </div>
        )}

        {/* Explanation accordion */}
        {showExplanation && explanation_de && (
          <div
            className="rounded-xl overflow-hidden animate-slide-up"
            style={{ background: 'rgba(186,230,253,0.04)', border: '1px solid rgba(186,230,253,0.12)' }}
          >
            <button
              className="flex items-center justify-between w-full px-4 py-3 text-left"
              onClick={() => setExplanationOpen((o) => !o)}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ice)' }}>
                Erklärung
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-4 h-4 transition-transform duration-200"
                style={{
                  color: 'var(--ice)',
                  transform: explanationOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {explanationOpen && (
              <div className="px-4 pb-4 animate-slide-down">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {explanation_de}
                </p>
              </div>
            )}
          </div>
        )}

        {/* New Vocabulary */}
        {showExplanation && new_vocabulary && new_vocabulary.length > 0 && (
          <div className="rounded-xl p-4 animate-slide-up" style={{ background: 'rgba(147,51,234,0.08)', border: '1px solid rgba(147,51,234,0.15)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(147,51,234,0.8)' }}>
              💡 Neue Vokabeln
            </p>
            <div className="space-y-2">
              {new_vocabulary.map((vocab, idx) => (
                <div key={idx} className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  <span className="font-semibold text-purple-400">{vocab.word}</span>
                  {' '}
                  <span style={{ color: 'var(--text-muted)' }}>→ {vocab.translation}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded ml-2" style={{ background: 'rgba(147,51,234,0.2)', color: 'rgba(147,51,234,0.7)' }}>
                    {vocab.cefr}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
