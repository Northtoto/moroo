'use client';

// ─── German News Reader ───────────────────────────────────────────────────────
// Fetches Deutsche Welle articles simplified to user's CEFR level.
// Key vocabulary extracted per article. Click a word to add to flashcards.

import { useState, useEffect, useCallback } from 'react';

type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

interface VocabItem { word: string; translation: string; cefr: string }

interface Article {
  title: string;
  original: string;
  simplified: string;
  vocabulary: VocabItem[];
  source: string;
  url: string;
  publishedAt: string;
}

const CEFR_LEVELS: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function LesenPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetCefr, setTargetCefr] = useState<DifficultyLevel>('B1');
  const [activeCefr, setActiveCefr] = useState<DifficultyLevel>('B1');
  const [showOriginal, setShowOriginal] = useState<Record<number, boolean>>({});
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [savingWord, setSavingWord] = useState<string | null>(null);

  const fetchArticles = useCallback(async (cefr: DifficultyLevel) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/news?cefr=${cefr}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json() as { articles: Article[]; targetCefr: DifficultyLevel };
      setArticles(data.articles ?? []);
      setActiveCefr(data.targetCefr ?? cefr);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(targetCefr); }, []);  // eslint-disable-line

  async function saveToFlashcards(vocab: VocabItem) {
    if (savedWords.has(vocab.word)) return;
    setSavingWord(vocab.word);
    try {
      // Add card to vocabulary_cards table via a simple upsert
      await fetch('/api/flashcards/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          german_word: vocab.word,
          english_translation: vocab.translation,
          cefr_level: vocab.cefr,
          topic_tags: ['nachrichten'],
        }),
      });
      setSavedWords(prev => new Set([...prev, vocab.word]));
    } finally {
      setSavingWord(null);
    }
  }

  const toggleOriginal = (idx: number) =>
    setShowOriginal(prev => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
          📰 Nachrichten auf Deutsch
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
          Aktuelle Artikel von Deutsche Welle — vereinfacht auf dein Niveau
        </p>

        {/* CEFR selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: 13 }}>Schwierigkeitsgrad:</span>
          {CEFR_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setTargetCefr(level)}
              style={{
                background: targetCefr === level ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.6)',
                border: `1px solid ${targetCefr === level ? 'rgba(245,158,11,0.5)' : 'rgba(148,163,184,0.15)'}`,
                color: targetCefr === level ? '#f59e0b' : '#64748b',
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {level}
            </button>
          ))}
          <button
            onClick={() => fetchArticles(targetCefr)}
            disabled={loading}
            style={{
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#3b82f6',
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginLeft: 4,
            }}
          >
            {loading ? 'Lädt…' : '↻ Neu laden'}
          </button>
        </div>
      </div>

      {/* Articles */}
      {loading && (
        <div style={{ textAlign: 'center', color: '#475569', padding: 60 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
          <p>Artikel werden vereinfacht…</p>
          <p style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>Das dauert ca. 15 Sekunden</p>
        </div>
      )}

      {!loading && articles.length === 0 && (
        <div style={{ textAlign: 'center', color: '#475569', padding: 60 }}>
          <p>Keine Artikel verfügbar. Bitte später erneut versuchen.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {articles.map((article, idx) => (
          <div
            key={idx}
            style={{
              background: 'rgba(30,41,59,0.8)',
              border: '1px solid rgba(148,163,184,0.12)',
              borderRadius: 16,
              overflow: 'hidden',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Article header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <h2 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.4 }}>
                  {article.title}
                </h2>
                <span style={{
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#f59e0b',
                  borderRadius: 20,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {activeCefr}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#475569' }}>
                <span>📡 {article.source}</span>
                {article.url && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6', textDecoration: 'none' }}
                  >
                    Original lesen ↗
                  </a>
                )}
              </div>
            </div>

            {/* Article body */}
            <div style={{ padding: '16px 24px' }}>
              <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                {showOriginal[idx] ? article.original : article.simplified}
              </p>

              <button
                onClick={() => toggleOriginal(idx)}
                style={{
                  marginTop: 10,
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {showOriginal[idx] ? '← Vereinfachte Version zeigen' : 'Original anzeigen'}
              </button>
            </div>

            {/* Vocabulary */}
            {article.vocabulary.length > 0 && (
              <div style={{ padding: '12px 24px 20px', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                <p style={{ color: '#64748b', fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Vokabeln
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {article.vocabulary.map(vocab => {
                    const isSaved = savedWords.has(vocab.word);
                    const isSaving = savingWord === vocab.word;
                    return (
                      <button
                        key={vocab.word}
                        onClick={() => saveToFlashcards(vocab)}
                        disabled={isSaved || isSaving}
                        title={`${vocab.translation} — Zur Karteikarte hinzufügen`}
                        style={{
                          background: isSaved ? 'rgba(34,197,94,0.12)' : 'rgba(30,41,59,0.6)',
                          border: `1px solid ${isSaved ? 'rgba(34,197,94,0.3)' : 'rgba(148,163,184,0.2)'}`,
                          borderRadius: 8,
                          padding: '6px 12px',
                          cursor: isSaved ? 'default' : 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 2,
                        }}
                      >
                        <span style={{ color: isSaved ? '#22c55e' : '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
                          {isSaved ? '✓ ' : ''}{vocab.word}
                        </span>
                        <span style={{ color: '#64748b', fontSize: 11 }}>{vocab.translation}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
