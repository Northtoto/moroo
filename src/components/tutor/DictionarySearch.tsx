'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DictionaryResult {
  id: string;
  german_word: string;
  article: string | null;
  plural_form: string | null;
  english_translation: string;
  cefr_level: string | null;
  word_type: string | null;
  example_sentence: string | null;
  grammar_notes: string | null;
  similarity_score: number;
}

const CEFR_COLORS: Record<string, { bg: string; text: string }> = {
  A1: { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e' },
  A2: { bg: 'rgba(34,197,94,0.10)',  text: '#86efac' },
  B1: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  B2: { bg: 'rgba(59,130,246,0.10)', text: '#93c5fd' },
  C1: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  C2: { bg: 'rgba(245,158,11,0.10)', text: '#fde68a' },
};

const WORD_TYPE_ICON: Record<string, string> = {
  noun:      'N',
  verb:      'V',
  adjective: 'Adj',
  adverb:    'Adv',
  phrase:    'Ph',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DictionarySearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DictionaryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Debounced search ──────────────────────────────────────────────────────
  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/dictionary?q=${encodeURIComponent(q)}&limit=8`);
      if (!res.ok) { setResults([]); return; }
      const { results: data } = await res.json();
      setResults(data ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setExpanded(null);
    inputRef.current?.focus();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Section label */}
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
      >
        Wörterbuch
      </p>

      {/* Search input */}
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          {loading ? (
            <span
              className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--amber)', borderTopColor: 'transparent' }}
            />
          ) : (
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className="w-3.5 h-3.5"
              style={{ color: 'var(--text-muted)' }}
            >
              <circle cx={11} cy={11} r={8} />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wort suchen… z.B. laufen"
          className="w-full pl-9 pr-8 py-2 rounded-xl text-sm transition-all"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            outline: 'none',
          }}
          aria-label="Deutsches Wort suchen"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-2 flex items-center px-1 rounded opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Suche löschen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-0.5">
          {results.map((word) => {
            const isOpen = expanded === word.id;
            const cefrStyle = word.cefr_level ? CEFR_COLORS[word.cefr_level] : null;
            const typeLabel = word.word_type ? (WORD_TYPE_ICON[word.word_type] ?? word.word_type) : null;

            return (
              <div
                key={word.id}
                className="rounded-xl overflow-hidden transition-all"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
              >
                {/* Row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : word.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                  aria-expanded={isOpen}
                >
                  {/* Article + word */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      {word.article && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {word.article}
                        </span>
                      )}
                      <span
                        className="text-sm font-semibold truncate"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                      >
                        {word.german_word}
                      </span>
                      {word.plural_form && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          · {word.plural_form}
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {word.english_translation}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {typeLabel && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}
                      >
                        {typeLabel}
                      </span>
                    )}
                    {cefrStyle && word.cefr_level && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: cefrStyle.bg, color: cefrStyle.text }}
                      >
                        {word.cefr_level}
                      </span>
                    )}
                    {/* Chevron */}
                    <svg
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                      className="w-3 h-3 transition-transform duration-200"
                      style={{
                        color: 'var(--text-muted)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div
                    className="px-3 pb-3 pt-1 space-y-2 text-xs animate-fade-up"
                    style={{ borderTop: '1px solid var(--glass-border)' }}
                  >
                    {word.example_sentence && (
                      <div>
                        <p className="font-semibold mb-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                          Beispiel
                        </p>
                        <p className="italic leading-relaxed" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                          „{word.example_sentence}"
                        </p>
                      </div>
                    )}
                    {word.grammar_notes && (
                      <div>
                        <p className="font-semibold mb-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                          Grammatik
                        </p>
                        <p style={{ color: 'var(--text-primary)' }}>{word.grammar_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No results */}
      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
          Kein Wort gefunden für „{query}"
        </p>
      )}

      {/* Hint when empty */}
      {query.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Tippe ein deutsches (oder englisches) Wort ein.
        </p>
      )}
    </div>
  );
}
