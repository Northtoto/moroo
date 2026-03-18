-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 017: German Dictionary Search
-- ═══════════════════════════════════════════════════════════════════════════
-- Enables fast fuzzy search across vocabulary_bank using pg_trgm.
--
-- Why pg_trgm (trigram matching)?
--   - Finds partial matches: "lauf" → laufen, Verlauf, auslaufen
--   - Students type incomplete or misspelled words — trigrams handle both
--   - GIN index makes similarity queries fast even on 200K+ rows
--
-- New columns added to vocabulary_bank:
--   - plural_form     TEXT   — e.g. "die Häuser" for "das Haus"
--   - word_type       TEXT   — noun | verb | adjective | adverb | phrase
--   - grammar_notes   TEXT   — e.g. "strong verb, irregular past: fuhr"
--   - pronunciation   TEXT   — IPA notation
--   - frequency_rank  INTEGER — 1=most common (from frequency lists)
--
-- RPC:
--   search_dictionary(query, limit, cefr_filter[]) → ranked results

-- ─── Enable pg_trgm extension ────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Add metadata columns to vocabulary_bank ─────────────────────────────────

ALTER TABLE public.vocabulary_bank ADD COLUMN IF NOT EXISTS word_type       TEXT    DEFAULT 'noun';
ALTER TABLE public.vocabulary_bank ADD COLUMN IF NOT EXISTS plural_form     TEXT;
ALTER TABLE public.vocabulary_bank ADD COLUMN IF NOT EXISTS grammar_notes   TEXT;
ALTER TABLE public.vocabulary_bank ADD COLUMN IF NOT EXISTS pronunciation   TEXT;
ALTER TABLE public.vocabulary_bank ADD COLUMN IF NOT EXISTS frequency_rank  INTEGER;

-- ─── Trigram GIN index — powers fuzzy search ─────────────────────────────────
-- GIN is faster than GIST for read-heavy dictionary lookups

CREATE INDEX IF NOT EXISTS idx_vocabulary_bank_trgm_german
  ON public.vocabulary_bank USING GIN (german_word gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vocabulary_bank_trgm_english
  ON public.vocabulary_bank USING GIN (english_translation gin_trgm_ops);

-- Prefix-search index for autocomplete (fast for "starts with" queries)
CREATE INDEX IF NOT EXISTS idx_vocabulary_bank_german_prefix
  ON public.vocabulary_bank (lower(german_word) text_pattern_ops);

-- Frequency rank index for ordered results
CREATE INDEX IF NOT EXISTS idx_vocabulary_bank_frequency
  ON public.vocabulary_bank (frequency_rank ASC NULLS LAST);

-- ─── RPC: search_dictionary ──────────────────────────────────────────────────
-- Fuzzy search across german_word and english_translation.
-- Returns results ranked by: exact match first → prefix match → trigram similarity.
-- Supports optional CEFR filter (pass NULL to search all levels).

DROP FUNCTION IF EXISTS public.search_dictionary(TEXT, INTEGER, TEXT[]);

CREATE OR REPLACE FUNCTION public.search_dictionary(
  p_query      TEXT,
  p_limit      INTEGER  DEFAULT 20,
  p_cefr       TEXT[]   DEFAULT NULL   -- NULL = all levels
)
RETURNS TABLE (
  id                  UUID,
  german_word         TEXT,
  article             TEXT,
  plural_form         TEXT,
  english_translation TEXT,
  cefr_level          TEXT,
  word_type           TEXT,
  example_sentence    TEXT,
  grammar_notes       TEXT,
  similarity_score    FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    vb.id,
    vb.german_word,
    vb.article,
    vb.plural_form,
    vb.english_translation,
    vb.cefr_level,
    vb.word_type,
    vb.example_sentence,
    vb.grammar_notes,
    -- Score: 1.0 for exact, 0.9 for case-insensitive, trigram similarity otherwise
    CASE
      WHEN vb.german_word = p_query                           THEN 1.0
      WHEN lower(vb.german_word) = lower(p_query)            THEN 0.9
      WHEN lower(vb.german_word) LIKE lower(p_query) || '%'  THEN 0.8
      ELSE similarity(lower(vb.german_word), lower(p_query))
    END AS similarity_score
  FROM public.vocabulary_bank vb
  WHERE
    -- CEFR filter (NULL = no filter)
    (p_cefr IS NULL OR vb.cefr_level = ANY(p_cefr))
    AND (
      -- Fuzzy match on german word
      lower(vb.german_word)  % lower(p_query)
      -- Also match on english translation
      OR lower(vb.english_translation) % lower(p_query)
      -- Always include exact/prefix matches even below similarity threshold
      OR lower(vb.german_word) LIKE lower(p_query) || '%'
    )
  ORDER BY
    similarity_score DESC,
    vb.frequency_rank ASC NULLS LAST,
    vb.german_word ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_dictionary(TEXT, INTEGER, TEXT[])
  TO authenticated, anon;

-- ─── RPC: get_word_detail ────────────────────────────────────────────────────
-- Returns full detail for a single word by german_word or id.

DROP FUNCTION IF EXISTS public.get_word_detail(TEXT);

CREATE OR REPLACE FUNCTION public.get_word_detail(
  p_german_word TEXT
)
RETURNS TABLE (
  id                  UUID,
  german_word         TEXT,
  article             TEXT,
  plural_form         TEXT,
  english_translation TEXT,
  cefr_level          TEXT,
  word_type           TEXT,
  example_sentence    TEXT,
  grammar_notes       TEXT,
  pronunciation       TEXT,
  frequency_rank      INTEGER,
  category            TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, german_word, article, plural_form,
    english_translation, cefr_level, word_type,
    example_sentence, grammar_notes, pronunciation,
    frequency_rank, category
  FROM public.vocabulary_bank
  WHERE lower(german_word) = lower(p_german_word)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_word_detail(TEXT)
  TO authenticated, anon;
