// ─── Adaptive Difficulty Engine ───────────────────────────────────────────────
// Adjusts exercise difficulty based on student's rolling accuracy.
// The "zone of proximal development" (Vygotsky): target 70-80% accuracy.
// Below 70% → easier. Above 85% → harder.
//
// Exported: getAdaptiveConfig(userId) → { difficulty, exerciseType, promptHint }

import { createClient as createServiceClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type ExerciseType = 'free_write' | 'gap_fill' | 'sentence_reorder' | 'error_spot' | 'translation';

export interface AdaptiveConfig {
  difficulty: DifficultyLevel;
  exerciseType: ExerciseType;
  promptHint: string;
  targetAccuracy: number;  // 0.0–1.0
  shouldChallenge: boolean;
}

// ─── CEFR progression order ───────────────────────────────────────────────────

const CEFR_ORDER: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function cefrUp(level: DifficultyLevel): DifficultyLevel {
  const i = CEFR_ORDER.indexOf(level);
  return CEFR_ORDER[Math.min(i + 1, CEFR_ORDER.length - 1)];
}

function cefrDown(level: DifficultyLevel): DifficultyLevel {
  const i = CEFR_ORDER.indexOf(level);
  return CEFR_ORDER[Math.max(i - 1, 0)];
}

// ─── Exercise type per CEFR band ─────────────────────────────────────────────
// Lower levels → guided exercises. Higher levels → open production.

const EXERCISE_BY_CEFR: Record<DifficultyLevel, ExerciseType[]> = {
  A1: ['gap_fill', 'sentence_reorder'],
  A2: ['gap_fill', 'sentence_reorder', 'translation'],
  B1: ['free_write', 'gap_fill', 'translation'],
  B2: ['free_write', 'error_spot', 'translation'],
  C1: ['free_write', 'error_spot'],
  C2: ['free_write', 'error_spot'],
};

function pickExerciseType(level: DifficultyLevel, errorTypes: string[]): ExerciseType {
  const options = EXERCISE_BY_CEFR[level];
  // If student has word order errors, prefer sentence_reorder when available
  if (errorTypes.includes('word_order') && options.includes('sentence_reorder')) {
    return 'sentence_reorder';
  }
  // If student has case errors, prefer error_spot when available
  if (
    (errorTypes.includes('accusative_case') || errorTypes.includes('dative_case')) &&
    options.includes('error_spot')
  ) {
    return 'error_spot';
  }
  return options[0];
}

// ─── Prompt hints per difficulty ─────────────────────────────────────────────

const PROMPT_HINTS: Record<DifficultyLevel, string> = {
  A1: 'Use simple present tense only. Focus on basic sentence structure (S-V-O).',
  A2: 'Include simple past (Perfekt) and modal verbs. Keep sentences short.',
  B1: 'Use subordinate clauses, separable verbs, and reflexive verbs.',
  B2: 'Include Konjunktiv II, passive voice, and complex clause structures.',
  C1: 'Use advanced idioms, extended clause chains, and stylistic variation.',
  C2: 'Near-native complexity. Nuanced register, rhetoric, and idiomatic precision.',
};

// ─── Core adaptive function ───────────────────────────────────────────────────

function computeAdaptiveConfig(
  currentCefr: DifficultyLevel,
  accuracy: number,  // rolling 10-correction accuracy
  topErrorTypes: string[]
): AdaptiveConfig {
  // Zone of proximal development: 70-85% is ideal
  let difficulty = currentCefr;
  let shouldChallenge = false;

  if (accuracy > 0.85 && currentCefr !== 'C2') {
    // Student is crushing it → step up
    difficulty = cefrUp(currentCefr);
    shouldChallenge = true;
  } else if (accuracy < 0.70 && currentCefr !== 'A1') {
    // Student is struggling → step down to build confidence
    difficulty = cefrDown(currentCefr);
  }
  // 0.70–0.85: maintain current level

  const exerciseType = pickExerciseType(difficulty, topErrorTypes);

  return {
    difficulty,
    exerciseType,
    promptHint: PROMPT_HINTS[difficulty],
    targetAccuracy: 0.75,
    shouldChallenge,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAdaptiveConfig(userId: string): Promise<AdaptiveConfig> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const defaults: AdaptiveConfig = {
    difficulty: 'A2',
    exerciseType: 'free_write',
    promptHint: PROMPT_HINTS['A2'],
    targetAccuracy: 0.75,
    shouldChallenge: false,
  };

  if (!url || !key) return defaults;

  try {
    const supabase = createServiceClient(url, key);

    const [stateResult, errorsResult] = await Promise.all([
      supabase
        .from('learning_state')
        .select('cefr_estimate, accuracy_last_10')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('error_patterns')
        .select('error_type')
        .eq('user_id', userId)
        .order('count', { ascending: false })
        .limit(3),
    ]);

    const cefr = (stateResult.data?.cefr_estimate ?? 'A2') as DifficultyLevel;
    const accuracy = stateResult.data?.accuracy_last_10 ?? 0.75;
    const topErrors = (errorsResult.data ?? []).map(e => e.error_type);

    return computeAdaptiveConfig(cefr, accuracy, topErrors);
  } catch {
    return defaults;
  }
}

// ─── Sync version (used when Supabase data is already in memory) ──────────────

export function getAdaptiveConfigSync(
  cefr: DifficultyLevel,
  accuracy: number,
  topErrorTypes: string[]
): AdaptiveConfig {
  return computeAdaptiveConfig(cefr, accuracy, topErrorTypes);
}

// ─── Update accuracy after correction ────────────────────────────────────────
// Called from updateStudentModel — increments total_corrections and
// recalculates accuracy_last_10 using an exponential moving average.

export async function updateAccuracy(
  userId: string,
  wasCorrect: boolean
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    const supabase = createServiceClient(url, key);

    const { data: state } = await supabase
      .from('learning_state')
      .select('accuracy_last_10, total_corrections')
      .eq('user_id', userId)
      .single();

    const prev = state?.accuracy_last_10 ?? 0.5;
    const total = state?.total_corrections ?? 0;

    // Exponential moving average with α=0.1 (weights ~10 recent corrections)
    const alpha = 0.1;
    const newAccuracy = alpha * (wasCorrect ? 1.0 : 0.0) + (1 - alpha) * prev;

    await supabase
      .from('learning_state')
      .update({
        accuracy_last_10: newAccuracy,
        total_corrections: total + 1,
        last_updated: new Date().toISOString(),
      })
      .eq('user_id', userId);
  } catch (err) {
    console.error('[adaptive-engine] updateAccuracy error:', err);
  }
}
