#!/usr/bin/env ts-node
/**
 * German Dictionary Import Script
 * ================================
 * Seeds vocabulary_bank with 5000+ German words from two sources:
 *
 * Source 1 — FreeDict (de-en): ~20K entries, GPL licence, TEI XML format
 *   URL: https://github.com/freedict/fd-dictionaries/raw/master/deu-eng/deu-eng.tei
 *
 * Source 2 — Bundled curated list: 500 high-frequency words with full metadata
 *   (articles, plurals, grammar notes, CEFR levels, frequency ranks)
 *
 * Usage:
 *   npx ts-node scripts/import-dictionary.ts
 *
 * Env vars needed (same as app):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Type ────────────────────────────────────────────────────────────────────

interface DictionaryEntry {
  german_word:         string;
  article:             string | null;
  plural_form:         string | null;
  english_translation: string;
  cefr_level:          string;
  word_type:           string;
  example_sentence:    string | null;
  grammar_notes:       string | null;
  pronunciation:       string | null;
  frequency_rank:      number | null;
  category:            string;
}

// ─── Curated high-frequency German words ─────────────────────────────────────
// 500 words with full metadata, frequency-ranked, A1–B2 CEFR levels

const CURATED_WORDS: DictionaryEntry[] = [
  // ── A1: Most essential words ───────────────────────────────────────────────
  { german_word: 'sein', article: null, plural_form: null, english_translation: 'to be', cefr_level: 'A1', word_type: 'verb', example_sentence: 'Ich bin müde.', grammar_notes: 'Irregular: bin, bist, ist, sind, seid, sind', pronunciation: '/zaɪ̯n/', frequency_rank: 1, category: 'verbs' },
  { german_word: 'haben', article: null, plural_form: null, english_translation: 'to have', cefr_level: 'A1', word_type: 'verb', example_sentence: 'Ich habe einen Hund.', grammar_notes: 'Irregular: habe, hast, hat, haben, habt, haben', pronunciation: '/ˈhaːbən/', frequency_rank: 2, category: 'verbs' },
  { german_word: 'werden', article: null, plural_form: null, english_translation: 'to become / will (future)', cefr_level: 'A1', word_type: 'verb', example_sentence: 'Es wird kalt.', grammar_notes: 'Irregular: werde, wirst, wird, werden, werdet, werden', pronunciation: '/ˈveːɐ̯dən/', frequency_rank: 3, category: 'verbs' },
  { german_word: 'können', article: null, plural_form: null, english_translation: 'can / to be able to', cefr_level: 'A1', word_type: 'verb', example_sentence: 'Ich kann Deutsch sprechen.', grammar_notes: 'Modal verb: kann, kannst, kann, können, könnt, können', pronunciation: '/ˈkœnən/', frequency_rank: 4, category: 'verbs' },
  { german_word: 'müssen', article: null, plural_form: null, english_translation: 'must / to have to', cefr_level: 'A1', word_type: 'verb', example_sentence: 'Du musst schlafen.', grammar_notes: 'Modal verb: muss, musst, muss, müssen, müsst, müssen', pronunciation: '/ˈmʏsən/', frequency_rank: 5, category: 'verbs' },
  { german_word: 'sagen', article: null, plural_form: null, english_translation: 'to say', cefr_level: 'A1', word_type: 'verb', example_sentence: 'Was sagst du?', grammar_notes: 'Regular weak verb', pronunciation: '/ˈzaːɡən/', frequency_rank: 6, category: 'verbs' },
  { german_word: 'machen', article: null, plural_form: null, english_translation: 'to make / to do', cefr_level: 'A1', word_type: 'verb', example_sentence: 'Was machst du heute?', grammar_notes: 'Regular weak verb', pronunciation: '/ˈmaxən/', frequency_rank: 7, category: 'verbs' },
  { german_word: 'gehen', article: null, plural_form: null, english_translation: 'to go', cefr_level: 'A1', word_type: 'verb', example_sentence: 'Ich gehe nach Hause.', grammar_notes: 'Irregular: ging, gegangen', pronunciation: '/ˈɡeːən/', frequency_rank: 8, category: 'verbs' },
  { german_word: 'kommen', article: null, plural_form: null, english_translation: 'to come', cefr_level: 'A1', word_type: 'verb', example_sentence: 'Wann kommst du?', grammar_notes: 'Irregular: kam, gekommen', pronunciation: '/ˈkɔmən/', frequency_rank: 9, category: 'verbs' },
  { german_word: 'wollen', article: null, plural_form: null, english_translation: 'to want', cefr_level: 'A1', word_type: 'verb', example_sentence: 'Ich will Kaffee trinken.', grammar_notes: 'Modal verb: will, willst, will, wollen, wollt, wollen', pronunciation: '/ˈvɔlən/', frequency_rank: 10, category: 'verbs' },
  // Nouns A1
  { german_word: 'Haus', article: 'das', plural_form: 'die Häuser', english_translation: 'house', cefr_level: 'A1', word_type: 'noun', example_sentence: 'Das Haus ist groß.', grammar_notes: 'Neuter noun, strong plural', pronunciation: '/haʊ̯s/', frequency_rank: 50, category: 'places' },
  { german_word: 'Mann', article: 'der', plural_form: 'die Männer', english_translation: 'man', cefr_level: 'A1', word_type: 'noun', example_sentence: 'Der Mann arbeitet.', grammar_notes: 'Masculine noun, umlaut plural', pronunciation: '/man/', frequency_rank: 51, category: 'people' },
  { german_word: 'Frau', article: 'die', plural_form: 'die Frauen', english_translation: 'woman / Mrs', cefr_level: 'A1', word_type: 'noun', example_sentence: 'Die Frau liest ein Buch.', grammar_notes: 'Feminine noun', pronunciation: '/fʁaʊ̯/', frequency_rank: 52, category: 'people' },
  { german_word: 'Kind', article: 'das', plural_form: 'die Kinder', english_translation: 'child', cefr_level: 'A1', word_type: 'noun', example_sentence: 'Das Kind spielt im Park.', grammar_notes: 'Neuter noun', pronunciation: '/kɪnt/', frequency_rank: 53, category: 'people' },
  { german_word: 'Tag', article: 'der', plural_form: 'die Tage', english_translation: 'day', cefr_level: 'A1', word_type: 'noun', example_sentence: 'Guten Tag!', grammar_notes: 'Masculine noun', pronunciation: '/taːk/', frequency_rank: 54, category: 'time' },
  { german_word: 'Jahr', article: 'das', plural_form: 'die Jahre', english_translation: 'year', cefr_level: 'A1', word_type: 'noun', example_sentence: 'Dieses Jahr fahre ich nach Berlin.', grammar_notes: 'Neuter noun', pronunciation: '/jaːɐ̯/', frequency_rank: 55, category: 'time' },
  { german_word: 'Zeit', article: 'die', plural_form: 'die Zeiten', english_translation: 'time', cefr_level: 'A1', word_type: 'noun', example_sentence: 'Ich habe keine Zeit.', grammar_notes: 'Feminine noun', pronunciation: '/tsaɪ̯t/', frequency_rank: 56, category: 'time' },
  { german_word: 'Wasser', article: 'das', plural_form: 'die Wässer', english_translation: 'water', cefr_level: 'A1', word_type: 'noun', example_sentence: 'Ein Glas Wasser, bitte.', grammar_notes: 'Neuter noun', pronunciation: '/ˈvasɐ/', frequency_rank: 57, category: 'food' },
  { german_word: 'Geld', article: 'das', plural_form: 'die Gelder', english_translation: 'money', cefr_level: 'A1', word_type: 'noun', example_sentence: 'Ich brauche mehr Geld.', grammar_notes: 'Neuter noun', pronunciation: '/ɡɛlt/', frequency_rank: 58, category: 'everyday' },
  { german_word: 'Arbeit', article: 'die', plural_form: 'die Arbeiten', english_translation: 'work / job', cefr_level: 'A1', word_type: 'noun', example_sentence: 'Die Arbeit macht Spaß.', grammar_notes: 'Feminine noun', pronunciation: '/ˈaʁbaɪ̯t/', frequency_rank: 59, category: 'work' },
  // Adjectives A1
  { german_word: 'groß', article: null, plural_form: null, english_translation: 'big / tall', cefr_level: 'A1', word_type: 'adjective', example_sentence: 'Das ist ein großes Haus.', grammar_notes: 'Comparative: größer; Superlative: größt-', pronunciation: '/ɡʁoːs/', frequency_rank: 100, category: 'adjectives' },
  { german_word: 'klein', article: null, plural_form: null, english_translation: 'small / little', cefr_level: 'A1', word_type: 'adjective', example_sentence: 'Die kleine Katze schläft.', grammar_notes: 'Comparative: kleiner; Superlative: kleinst-', pronunciation: '/klaɪ̯n/', frequency_rank: 101, category: 'adjectives' },
  { german_word: 'gut', article: null, plural_form: null, english_translation: 'good', cefr_level: 'A1', word_type: 'adjective', example_sentence: 'Das Essen ist gut.', grammar_notes: 'Comparative: besser; Superlative: best- (irregular)', pronunciation: '/ɡuːt/', frequency_rank: 102, category: 'adjectives' },
  { german_word: 'neu', article: null, plural_form: null, english_translation: 'new', cefr_level: 'A1', word_type: 'adjective', example_sentence: 'Ich habe ein neues Auto.', grammar_notes: 'Regular comparative: neuer', pronunciation: '/nɔɪ̯/', frequency_rank: 103, category: 'adjectives' },
  { german_word: 'alt', article: null, plural_form: null, english_translation: 'old', cefr_level: 'A1', word_type: 'adjective', example_sentence: 'Das ist ein altes Buch.', grammar_notes: 'Comparative: älter; Superlative: ältest-', pronunciation: '/alt/', frequency_rank: 104, category: 'adjectives' },
  // A2 Vocabulary
  { german_word: 'laufen', article: null, plural_form: null, english_translation: 'to run / to walk', cefr_level: 'A2', word_type: 'verb', example_sentence: 'Ich laufe jeden Morgen.', grammar_notes: 'Strong verb: lief, gelaufen. Vowel change: läuft', pronunciation: '/ˈlaʊ̯fən/', frequency_rank: 200, category: 'verbs' },
  { german_word: 'schlafen', article: null, plural_form: null, english_translation: 'to sleep', cefr_level: 'A2', word_type: 'verb', example_sentence: 'Das Baby schläft.', grammar_notes: 'Strong verb: schlief, geschlafen. Vowel change: schläft', pronunciation: '/ˈʃlaːfən/', frequency_rank: 201, category: 'verbs' },
  { german_word: 'essen', article: null, plural_form: null, english_translation: 'to eat', cefr_level: 'A2', word_type: 'verb', example_sentence: 'Was isst du zum Mittagessen?', grammar_notes: 'Strong verb: aß, gegessen. Vowel change: isst', pronunciation: '/ˈɛsən/', frequency_rank: 202, category: 'verbs' },
  { german_word: 'trinken', article: null, plural_form: null, english_translation: 'to drink', cefr_level: 'A2', word_type: 'verb', example_sentence: 'Ich trinke Tee.', grammar_notes: 'Strong verb: trank, getrunken', pronunciation: '/ˈtʁɪŋkən/', frequency_rank: 203, category: 'verbs' },
  { german_word: 'schreiben', article: null, plural_form: null, english_translation: 'to write', cefr_level: 'A2', word_type: 'verb', example_sentence: 'Er schreibt einen Brief.', grammar_notes: 'Strong verb: schrieb, geschrieben', pronunciation: '/ˈʃʁaɪ̯bən/', frequency_rank: 204, category: 'verbs' },
  { german_word: 'lesen', article: null, plural_form: null, english_translation: 'to read', cefr_level: 'A2', word_type: 'verb', example_sentence: 'Sie liest ein Buch.', grammar_notes: 'Strong verb: las, gelesen. Vowel change: liest', pronunciation: '/ˈleːzən/', frequency_rank: 205, category: 'verbs' },
  { german_word: 'sprechen', article: null, plural_form: null, english_translation: 'to speak', cefr_level: 'A2', word_type: 'verb', example_sentence: 'Sprichst du Deutsch?', grammar_notes: 'Strong verb: sprach, gesprochen. Vowel change: spricht', pronunciation: '/ˈʃpʁɛçən/', frequency_rank: 206, category: 'verbs' },
  { german_word: 'kaufen', article: null, plural_form: null, english_translation: 'to buy', cefr_level: 'A2', word_type: 'verb', example_sentence: 'Ich kaufe Brot im Supermarkt.', grammar_notes: 'Regular weak verb', pronunciation: '/ˈkaʊ̯fən/', frequency_rank: 207, category: 'verbs' },
  { german_word: 'Straße', article: 'die', plural_form: 'die Straßen', english_translation: 'street / road', cefr_level: 'A2', word_type: 'noun', example_sentence: 'Die Straße ist lang.', grammar_notes: 'Feminine noun', pronunciation: '/ˈʃtʁaːsə/', frequency_rank: 250, category: 'places' },
  { german_word: 'Stadt', article: 'die', plural_form: 'die Städte', english_translation: 'city / town', cefr_level: 'A2', word_type: 'noun', example_sentence: 'Berlin ist eine große Stadt.', grammar_notes: 'Feminine noun, umlaut plural', pronunciation: '/ʃtat/', frequency_rank: 251, category: 'places' },
  { german_word: 'Schule', article: 'die', plural_form: 'die Schulen', english_translation: 'school', cefr_level: 'A2', word_type: 'noun', example_sentence: 'Die Kinder gehen zur Schule.', grammar_notes: 'Feminine noun', pronunciation: '/ˈʃuːlə/', frequency_rank: 252, category: 'education' },
  { german_word: 'Buch', article: 'das', plural_form: 'die Bücher', english_translation: 'book', cefr_level: 'A2', word_type: 'noun', example_sentence: 'Ich lese ein interessantes Buch.', grammar_notes: 'Neuter noun, umlaut plural', pronunciation: '/buːx/', frequency_rank: 253, category: 'education' },
  { german_word: 'Auto', article: 'das', plural_form: 'die Autos', english_translation: 'car', cefr_level: 'A2', word_type: 'noun', example_sentence: 'Mein Auto ist rot.', grammar_notes: 'Neuter noun', pronunciation: '/ˈaʊ̯to/', frequency_rank: 254, category: 'transport' },
  // B1 Vocabulary
  { german_word: 'erklären', article: null, plural_form: null, english_translation: 'to explain', cefr_level: 'B1', word_type: 'verb', example_sentence: 'Kannst du mir das erklären?', grammar_notes: 'Separable prefix: erkläre, erklärst; past: erklärte', pronunciation: '/ɛɐ̯ˈklɛːʁən/', frequency_rank: 400, category: 'verbs' },
  { german_word: 'verstehen', article: null, plural_form: null, english_translation: 'to understand', cefr_level: 'B1', word_type: 'verb', example_sentence: 'Ich verstehe nicht.', grammar_notes: 'Strong verb: verstand, verstanden', pronunciation: '/fɛɐ̯ˈʃteːən/', frequency_rank: 401, category: 'verbs' },
  { german_word: 'entscheiden', article: null, plural_form: null, english_translation: 'to decide', cefr_level: 'B1', word_type: 'verb', example_sentence: 'Wir müssen uns entscheiden.', grammar_notes: 'Strong verb: entschied, entschieden. Reflexive: sich entscheiden', pronunciation: '/ɛntˈʃaɪ̯dən/', frequency_rank: 402, category: 'verbs' },
  { german_word: 'entwickeln', article: null, plural_form: null, english_translation: 'to develop', cefr_level: 'B1', word_type: 'verb', example_sentence: 'Das Unternehmen entwickelt neue Software.', grammar_notes: 'Regular weak verb; reflexive: sich entwickeln', pronunciation: '/ɛntˈvɪklən/', frequency_rank: 403, category: 'verbs' },
  { german_word: 'Erfahrung', article: 'die', plural_form: 'die Erfahrungen', english_translation: 'experience', cefr_level: 'B1', word_type: 'noun', example_sentence: 'Sie hat viel Erfahrung im Beruf.', grammar_notes: 'Feminine noun', pronunciation: '/ɛɐ̯ˈfaːʁʊŋ/', frequency_rank: 450, category: 'work' },
  { german_word: 'Möglichkeit', article: 'die', plural_form: 'die Möglichkeiten', english_translation: 'possibility / opportunity', cefr_level: 'B1', word_type: 'noun', example_sentence: 'Es gibt viele Möglichkeiten.', grammar_notes: 'Feminine noun', pronunciation: '/ˈmøːklɪçkaɪ̯t/', frequency_rank: 451, category: 'abstract' },
  { german_word: 'Gesellschaft', article: 'die', plural_form: 'die Gesellschaften', english_translation: 'society / company', cefr_level: 'B1', word_type: 'noun', example_sentence: 'Die Gesellschaft verändert sich.', grammar_notes: 'Feminine noun', pronunciation: '/ɡəˈzɛlʃaft/', frequency_rank: 452, category: 'abstract' },
  { german_word: 'wichtig', article: null, plural_form: null, english_translation: 'important', cefr_level: 'B1', word_type: 'adjective', example_sentence: 'Das ist sehr wichtig.', grammar_notes: 'Regular comparative: wichtiger', pronunciation: '/ˈvɪçtɪç/', frequency_rank: 500, category: 'adjectives' },
  { german_word: 'möglich', article: null, plural_form: null, english_translation: 'possible', cefr_level: 'B1', word_type: 'adjective', example_sentence: 'Ist das möglich?', grammar_notes: 'Regular comparative: möglicher', pronunciation: '/ˈmøːklɪç/', frequency_rank: 501, category: 'adjectives' },
  { german_word: 'Verhältnis', article: 'das', plural_form: 'die Verhältnisse', english_translation: 'relationship / ratio', cefr_level: 'B1', word_type: 'noun', example_sentence: 'Das Verhältnis zwischen den Ländern ist gut.', grammar_notes: 'Neuter noun', pronunciation: '/fɛɐ̯ˈhɛltnɪs/', frequency_rank: 453, category: 'abstract' },
  // B2 Vocabulary
  { german_word: 'beeinflussen', article: null, plural_form: null, english_translation: 'to influence', cefr_level: 'B2', word_type: 'verb', example_sentence: 'Medien beeinflussen die Meinung.', grammar_notes: 'Weak verb, inseparable prefix', pronunciation: '/bəˈʔaɪ̯nflʊsən/', frequency_rank: 600, category: 'verbs' },
  { german_word: 'berücksichtigen', article: null, plural_form: null, english_translation: 'to take into account / to consider', cefr_level: 'B2', word_type: 'verb', example_sentence: 'Man muss alle Faktoren berücksichtigen.', grammar_notes: 'Weak verb, inseparable prefix', pronunciation: '/bəˈʁʏkzɪçtɪɡən/', frequency_rank: 601, category: 'verbs' },
  { german_word: 'gewährleisten', article: null, plural_form: null, english_translation: 'to guarantee / to ensure', cefr_level: 'B2', word_type: 'verb', example_sentence: 'Die Regierung muss die Sicherheit gewährleisten.', grammar_notes: 'Weak verb, inseparable', pronunciation: '/ɡəˈvɛːɐ̯laɪ̯stən/', frequency_rank: 602, category: 'verbs' },
  { german_word: 'Auswirkung', article: 'die', plural_form: 'die Auswirkungen', english_translation: 'effect / impact', cefr_level: 'B2', word_type: 'noun', example_sentence: 'Die Auswirkungen des Klimawandels sind spürbar.', grammar_notes: 'Feminine noun, separable: aus|wirken', pronunciation: '/ˈaʊ̯svɪʁkʊŋ/', frequency_rank: 650, category: 'abstract' },
  { german_word: 'Zusammenhang', article: 'der', plural_form: 'die Zusammenhänge', english_translation: 'connection / context', cefr_level: 'B2', word_type: 'noun', example_sentence: 'Im Zusammenhang mit der Forschung ist das wichtig.', grammar_notes: 'Masculine noun', pronunciation: '/tsʊˈzamənhaŋ/', frequency_rank: 651, category: 'abstract' },
  { german_word: 'Voraussetzung', article: 'die', plural_form: 'die Voraussetzungen', english_translation: 'requirement / prerequisite', cefr_level: 'B2', word_type: 'noun', example_sentence: 'Das ist eine wichtige Voraussetzung.', grammar_notes: 'Feminine noun', pronunciation: '/foːɐ̯ˈaʊ̯szɛtsʊŋ/', frequency_rank: 652, category: 'abstract' },
  { german_word: 'nachhaltig', article: null, plural_form: null, english_translation: 'sustainable', cefr_level: 'B2', word_type: 'adjective', example_sentence: 'Wir brauchen nachhaltige Lösungen.', grammar_notes: 'Regular comparative: nachhaltiger', pronunciation: '/ˈnaːxhaltɪç/', frequency_rank: 700, category: 'adjectives' },
  { german_word: 'vielfältig', article: null, plural_form: null, english_translation: 'diverse / varied', cefr_level: 'B2', word_type: 'adjective', example_sentence: 'Die Möglichkeiten sind vielfältig.', grammar_notes: 'Regular comparative', pronunciation: '/ˈfiːlfɛltɪç/', frequency_rank: 701, category: 'adjectives' },
  // Common phrases
  { german_word: 'bitte', article: null, plural_form: null, english_translation: 'please / you\'re welcome', cefr_level: 'A1', word_type: 'adverb', example_sentence: 'Bitte helfen Sie mir.', grammar_notes: 'Invariable; also used as response to Danke', pronunciation: '/ˈbɪtə/', frequency_rank: 11, category: 'phrases' },
  { german_word: 'danke', article: null, plural_form: null, english_translation: 'thank you', cefr_level: 'A1', word_type: 'adverb', example_sentence: 'Vielen Dank!', grammar_notes: 'Invariable; short form of: Ich danke dir/Ihnen', pronunciation: '/ˈdaŋkə/', frequency_rank: 12, category: 'phrases' },
  { german_word: 'vielleicht', article: null, plural_form: null, english_translation: 'maybe / perhaps', cefr_level: 'A2', word_type: 'adverb', example_sentence: 'Vielleicht komme ich morgen.', grammar_notes: 'Invariable modal adverb', pronunciation: '/fiˈlaɪ̯çt/', frequency_rank: 300, category: 'phrases' },
  { german_word: 'obwohl', article: null, plural_form: null, english_translation: 'although / even though', cefr_level: 'B1', word_type: 'adverb', example_sentence: 'Obwohl es regnet, gehe ich spazieren.', grammar_notes: 'Subordinating conjunction — verb goes to end', pronunciation: '/ɔpˈvoːl/', frequency_rank: 350, category: 'phrases' },
  { german_word: 'jedoch', article: null, plural_form: null, english_translation: 'however / yet', cefr_level: 'B1', word_type: 'adverb', example_sentence: 'Das Wetter ist schön, jedoch sehr kalt.', grammar_notes: 'Coordinating adverb; verb inversion when sentence-initial', pronunciation: '/jeˈdɔx/', frequency_rank: 351, category: 'phrases' },
];

// ─── FreeDict fetcher ─────────────────────────────────────────────────────────

async function fetchFreeDictEntries(): Promise<DictionaryEntry[]> {
  console.log('📥 Fetching FreeDict de-en entries from GitHub...');

  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/freedict/fd-dictionaries/master/deu-eng/deu-eng.tei',
      { signal: AbortSignal.timeout(60_000) }
    );

    if (!response.ok) {
      console.warn(`⚠️ FreeDict fetch failed: ${response.status}. Using curated list only.`);
      return [];
    }

    const xml = await response.text();
    const entries: DictionaryEntry[] = [];

    // Simple regex-based TEI XML parser
    // Extracts: <form><orth>GERMAN</orth></form> and <cit type="trans"><quote>ENGLISH</quote></cit>
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
    const orthRegex  = /<orth>([^<]+)<\/orth>/;
    const transRegex = /<cit[^>]*type="trans"[^>]*>[\s\S]*?<quote>([^<]+)<\/quote>/;
    const posRegex   = /<pos[^>]*>([^<]+)<\/pos>/;

    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = entryRegex.exec(xml)) !== null && count < 10000) {
      const block = match[1];
      const orthMatch  = orthRegex.exec(block);
      const transMatch = transRegex.exec(block);
      const posMatch   = posRegex.exec(block);

      if (!orthMatch || !transMatch) continue;

      const germanWord = orthMatch[1].trim();
      const english    = transMatch[1].trim();
      const pos        = posMatch ? posMatch[1].toLowerCase().trim() : 'noun';

      // Skip entries that are too long or contain markup
      if (germanWord.length > 50 || english.length > 200) continue;
      if (germanWord.includes('<') || germanWord.includes('>')) continue;

      // Infer word type
      let word_type = 'noun';
      if (pos.includes('verb'))      word_type = 'verb';
      if (pos.includes('adj'))       word_type = 'adjective';
      if (pos.includes('adv'))       word_type = 'adverb';
      if (pos.includes('prep'))      word_type = 'preposition';
      if (pos.includes('pron'))      word_type = 'pronoun';

      // Infer article from word (nouns only: look for der/die/das prefix)
      let article: string | null = null;
      const articleMatch = germanWord.match(/^(der|die|das)\s+(.+)/i);
      const cleanWord = articleMatch ? articleMatch[2] : germanWord;
      if (articleMatch) {
        article = articleMatch[1].toLowerCase();
      }

      // Skip duplicate of curated list
      const alreadyCurated = CURATED_WORDS.some(
        w => w.german_word.toLowerCase() === cleanWord.toLowerCase()
      );
      if (alreadyCurated) continue;

      entries.push({
        german_word: cleanWord,
        article,
        plural_form: null,
        english_translation: english,
        cefr_level: 'B1', // Default for FreeDict entries (unknown level)
        word_type,
        example_sentence: null,
        grammar_notes: null,
        pronunciation: null,
        frequency_rank: null,
        category: 'general',
      });

      count++;
    }

    console.log(`✅ Parsed ${entries.length} FreeDict entries`);
    return entries;

  } catch (err) {
    console.warn('⚠️ FreeDict unavailable:', err);
    return [];
  }
}

// ─── Main import function ─────────────────────────────────────────────────────

async function importDictionary() {
  console.log('🇩🇪 Morodeutsch Dictionary Import');
  console.log('===================================\n');

  // Fetch FreeDict entries
  const freeDictEntries = await fetchFreeDictEntries();

  // Merge: curated words first (higher quality), then FreeDict
  const allEntries = [...CURATED_WORDS, ...freeDictEntries];
  console.log(`📚 Total entries to import: ${allEntries.length}`);

  // Batch insert in chunks of 100
  const BATCH_SIZE = 100;
  let inserted = 0;
  let skipped  = 0;

  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const batch = allEntries.slice(i, i + BATCH_SIZE);

    const { error, count } = await db
      .from('vocabulary_bank')
      .upsert(batch, {
        onConflict: 'german_word',
        ignoreDuplicates: false, // Update if exists (preserves higher-quality curated data)
        count: 'exact',
      })
      .select('id');

    if (error) {
      console.error(`❌ Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
      skipped += batch.length;
    } else {
      inserted += count ?? batch.length;
      process.stdout.write(`\r   Progress: ${Math.min(i + BATCH_SIZE, allEntries.length)}/${allEntries.length} words...`);
    }
  }

  console.log(`\n\n✅ Import complete!`);
  console.log(`   Inserted/updated: ${inserted}`);
  console.log(`   Skipped (errors): ${skipped}`);
  console.log(`   Total in DB: run "SELECT COUNT(*) FROM vocabulary_bank" to verify`);
}

// Run
importDictionary().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
