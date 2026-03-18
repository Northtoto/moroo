'use client';

// ─── Flashcard Review Page (FSRS Spaced Repetition) ─────────────────────────

import { useState, useEffect, useCallback } from 'react';

interface FlashCard {
  card_id: string;
  german_word: string;
  english_translation: string;
  cefr_level: string;
  topic_tags: string[];
  stability: number;
  due: string;
}

type Phase = 'loading' | 'idle' | 'question' | 'answer' | 'done';

const RATING_LABELS: Record<number, { label: string; color: string; hint: string }> = {
  1: { label: 'Wieder', color: '#ef4444', hint: 'Falsch / komplett vergessen' },
  2: { label: 'Schwer', color: '#f97316', hint: 'Richtig, aber mühsam' },
  3: { label: 'Gut', color: '#22c55e', hint: 'Richtig mit kleiner Pause' },
  4: { label: 'Einfach', color: '#3b82f6', hint: 'Sofort gewusst' },
};

export default function FlashcardsPage() {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [submitting, setSubmitting] = useState(false);

  const fetchDueCards = useCallback(async () => {
    setPhase('loading');
    try {
      const res = await fetch('/api/flashcards/review', { credentials: 'include' });
      if (!res.ok) throw new Error('fetch failed');
      const { cards: due } = await res.json() as { cards: FlashCard[] };
      setCards(due);
      setIndex(0);
      setPhase(due.length > 0 ? 'question' : 'done');
    } catch {
      setPhase('idle');
    }
  }, []);

  useEffect(() => { fetchDueCards(); }, [fetchDueCards]);

  const current = cards[index];

  const submitRating = useCallback(async (rating: 1 | 2 | 3 | 4) => {
    if (!current || submitting) return;
    setSubmitting(true);

    try {
      await fetch('/api/flashcards/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ card_id: current.card_id, rating }),
      });

      setSessionStats(prev => ({
        reviewed: prev.reviewed + 1,
        correct: prev.correct + (rating >= 3 ? 1 : 0),
      }));

      const nextIndex = index + 1;
      if (nextIndex >= cards.length) {
        setPhase('done');
      } else {
        setIndex(nextIndex);
        setPhase('question');
      }
    } finally {
      setSubmitting(false);
    }
  }, [current, submitting, index, cards.length]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase === 'question' && e.code === 'Space') {
        e.preventDefault();
        setPhase('answer');
      } else if (phase === 'answer') {
        const keyMap: Record<string, 1 | 2 | 3 | 4> = {
          Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4,
          Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4,
        };
        const rating = keyMap[e.code];
        if (rating) submitRating(rating);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, submitRating]);

  // ── Render states ───────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
          <p>Lade Karten…</p>
        </div>
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
        <p style={{ color: '#ef4444' }}>Fehler beim Laden der Karten.</p>
        <button onClick={fetchDueCards} style={btnStyle('#3b82f6')}>Erneut versuchen</button>
      </div>
    );
  }

  if (phase === 'done') {
    const accuracy = sessionStats.reviewed > 0
      ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100)
      : 0;
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ color: '#f1f5f9', fontSize: 24, marginBottom: 8 }}>Sitzung abgeschlossen!</h2>
        <p style={{ color: '#94a3b8', marginBottom: 24 }}>
          {sessionStats.reviewed} Karten · {accuracy}% korrekt
        </p>
        <button onClick={fetchDueCards} style={btnStyle('#22c55e')}>
          Weitere Karten laden
        </button>
      </div>
    );
  }

  if (!current) return null;

  const progress = cards.length > 0 ? ((index) / cards.length) * 100 : 0;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700 }}>Vokabeln wiederholen</h1>
        <span style={{ color: '#94a3b8', fontSize: 14 }}>{index + 1} / {cards.length}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#1e293b', borderRadius: 2, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: '#f59e0b', transition: 'width 0.3s ease' }} />
      </div>

      {/* Card */}
      <div style={{
        background: 'rgba(30,41,59,0.8)',
        border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: 16,
        padding: '48px 32px',
        textAlign: 'center',
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        backdropFilter: 'blur(8px)',
      }}>
        {/* CEFR badge */}
        <span style={{
          background: 'rgba(245,158,11,0.15)',
          color: '#f59e0b',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 20,
          padding: '2px 10px',
          fontSize: 12,
          fontWeight: 600,
        }}>
          {current.cefr_level}
        </span>

        {/* German word */}
        <h2 style={{ color: '#f1f5f9', fontSize: 36, fontWeight: 700, margin: 0 }}>
          {current.german_word}
        </h2>

        {/* Tags */}
        {current.topic_tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {current.topic_tags.slice(0, 3).map(tag => (
              <span key={tag} style={{ color: '#64748b', fontSize: 12 }}>#{tag}</span>
            ))}
          </div>
        )}

        {/* Answer reveal */}
        {phase === 'answer' ? (
          <div style={{
            borderTop: '1px solid rgba(148,163,184,0.15)',
            paddingTop: 20,
            width: '100%',
            marginTop: 8,
          }}>
            <p style={{ color: '#22c55e', fontSize: 24, fontWeight: 600, margin: 0 }}>
              {current.english_translation}
            </p>
          </div>
        ) : (
          <button
            onClick={() => setPhase('answer')}
            style={btnStyle('#475569')}
          >
            Lösung zeigen <span style={{ opacity: 0.5, fontSize: 12 }}>(Leertaste)</span>
          </button>
        )}
      </div>

      {/* Rating buttons */}
      {phase === 'answer' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 20 }}>
          {([1, 2, 3, 4] as const).map(r => {
            const { label, color, hint } = RATING_LABELS[r];
            return (
              <button
                key={r}
                onClick={() => submitRating(r)}
                disabled={submitting}
                title={hint}
                style={{
                  background: `${color}22`,
                  border: `1px solid ${color}66`,
                  borderRadius: 10,
                  color,
                  padding: '12px 8px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{r}</div>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Keyboard hint */}
      {phase === 'answer' && (
        <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
          Tastenkürzel: 1 · 2 · 3 · 4
        </p>
      )}
    </div>
  );
}

function btnStyle(bg: string) {
  return {
    background: `${bg}22`,
    border: `1px solid ${bg}66`,
    color: bg,
    borderRadius: 10,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  } as React.CSSProperties;
}
