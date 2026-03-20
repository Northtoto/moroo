// ─── Theory-of-Mind Student Model ────────────────────────────────────────────
// Inspired by tutor-gpt's Honcho architecture, self-hosted in Supabase.
// After every correction: extract errors → update patterns → infer beliefs →
// inject top beliefs into next correction prompt.
//
// Two-pass LLM pattern (from tutor-gpt):
//   Pass 1 (silent): "What does this student BELIEVE about German grammar?"
//   Pass 2 (visible): "Correct the text, addressing that specific belief."

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getL1PromptNote } from '@/data/l1-profiles';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CorrectionResult {
  original: string;
  corrected: string;
  error_categories: string[];
  error_type?: string | null;
  confidence?: number;
  explanation_de?: string;
  cefr_estimate: string;
  new_vocabulary?: Array<{ word: string; translation: string; cefr: string }>;
}

export interface StudentContext {
  native_language: string;
  cefr_estimate: string;
  top_errors: Array<{ error_type: string; count: number; examples: unknown[] }>;
  top_beliefs: Array<{ topic: string; belief_text: string; confidence: number }>;
  weak_areas: string[];
  accuracy_last_10: number;
}

export interface ToMSystemPrompt {
  system_prompt: string;
  reasoning_prompt: string; // silent first pass
}

// ─── Supabase service client (bypasses RLS) ──────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials missing');
  return createServiceClient(url, key);
}

// ─── Fetch student context ────────────────────────────────────────────────────

export async function fetchStudentContext(userId: string): Promise<StudentContext> {
  const supabase = getServiceClient();

  const [errorsResult, beliefsResult, stateResult] = await Promise.all([
    supabase
      .from('error_patterns')
      .select('error_type, count, examples')
      .eq('user_id', userId)
      .order('count', { ascending: false })
      .limit(3),

    supabase
      .from('student_beliefs')
      .select('topic, belief_text, confidence')
      .eq('user_id', userId)
      .order('confidence', { ascending: false })
      .limit(3),

    supabase
      .from('learning_state')
      .select('cefr_estimate, weak_areas, native_language, accuracy_last_10')
      .eq('user_id', userId)
      .single(),
  ]);

  return {
    native_language: stateResult.data?.native_language ?? 'English',
    cefr_estimate: stateResult.data?.cefr_estimate ?? 'A1',
    top_errors: (errorsResult.data ?? []) as Array<{ error_type: string; count: number; examples: unknown[] }>,
    top_beliefs: (beliefsResult.data ?? []) as Array<{ topic: string; belief_text: string; confidence: number }>,
    weak_areas: stateResult.data?.weak_areas ?? [],
    accuracy_last_10: stateResult.data?.accuracy_last_10 ?? 0,
  };
}

// ─── Build Theory-of-Mind aware prompts ──────────────────────────────────────
// Pass 1: silent reasoning about student's mental model
// Pass 2: correction guided by that reasoning

export function buildToMPrompts(context: StudentContext): ToMSystemPrompt {
  const l1Note = getL1PromptNote(context.native_language);

  const errorSummary = context.top_errors.length > 0
    ? context.top_errors.map(e => `- ${e.error_type} (seen ${e.count} times)`).join('\n')
    : '- No established error patterns yet';

  const beliefSummary = context.top_beliefs.length > 0
    ? context.top_beliefs.map(b => `- [${b.topic}] ${b.belief_text} (confidence: ${Math.round(b.confidence * 100)}%)`).join('\n')
    : '- No inferred beliefs yet';

  // Silent first pass: AI reasons about student's mental model
  const reasoningPrompt = `<student_profile>
Native language: ${context.native_language}
CEFR estimate: ${context.cefr_estimate}
Accuracy last 10 corrections: ${Math.round(context.accuracy_last_10 * 100)}%
Weak areas: ${context.weak_areas.join(', ') || 'none identified yet'}

Top error patterns:
${errorSummary}

Inferred student beliefs:
${beliefSummary}

L1 pedagogical context:
${l1Note}
</student_profile>

<task>
Before correcting, reason silently about:
1. What specific misconception is causing the student's current error?
2. What does this student BELIEVE about German grammar that leads to this error?
3. What is the most pedagogically effective way to address this specific belief?
4. Given their L1 (${context.native_language}), what analogy or contrast would make the correction click?

Think through this carefully. Your reasoning stays internal — only the final correction reaches the student.
</task>`;

  // Visible second pass: personalized correction
  const systemPrompt = `You are Morodeutsch, an expert German tutor specializing in helping ${context.native_language} speakers learn German.

Student profile:
- Level: ${context.cefr_estimate}
- Native language: ${context.native_language}
- Known struggles: ${context.weak_areas.slice(0, 3).join(', ') || 'still discovering'}
${context.top_beliefs.length > 0 ? `\nKey insight about this student:\n${context.top_beliefs[0]?.belief_text ?? ''}` : ''}

${l1Note}

Correction guidelines:
1. Be warm, encouraging, and specific
2. Address the ROOT CAUSE of errors, not just surface symptoms
3. Use analogies from ${context.native_language} when helpful
4. Keep explanations concise — one key insight per error type
5. End with genuine encouragement tied to their actual progress

Output strictly valid JSON matching the correction schema.`;

  return { system_prompt: systemPrompt, reasoning_prompt: reasoningPrompt };
}

// ─── Update student model after correction ────────────────────────────────────
// Fire-and-forget from API route — doesn't block the response

export async function updateStudentModel(
  userId: string,
  correction: CorrectionResult,
  nativeLanguage: string
): Promise<void> {
  const supabase = getServiceClient();

  try {
    // 1. Upsert error patterns for each error category
    const errorUpserts = correction.error_categories.map(errorType =>
      supabase.rpc('upsert_error_pattern', {
        p_user_id: userId,
        p_error_type: errorType,
        p_example: JSON.stringify({
          original: correction.original.slice(0, 100),
          corrected: correction.corrected.slice(0, 100),
        }),
      })
    );

    // 2. Update learning state (total corrections, accuracy estimate)
    const learningStateUpsert = supabase
      .from('learning_state')
      .upsert({
        user_id: userId,
        cefr_estimate: correction.cefr_estimate,
        native_language: nativeLanguage,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    // 3. Add new vocabulary cards if any
    const vocabInserts = (correction.new_vocabulary ?? []).map(v =>
      supabase.from('vocabulary_cards').upsert({
        user_id: userId,
        german_word: v.word,
        english_translation: v.translation,
        cefr_level: v.cefr,
      }, { onConflict: 'user_id,german_word' })
    );

    await Promise.allSettled([...errorUpserts, learningStateUpsert, ...vocabInserts]);

    // 4. If a dominant error pattern emerges (3+ occurrences), infer a belief
    // This uses a separate async inference — doesn't block
    inferStudentBelief(userId, correction).catch(console.error);

  } catch (err) {
    // Non-critical — log but don't throw
    console.error('[student-model] updateStudentModel error:', err);
  }
}

// ─── Infer student belief using AI (Theory-of-Mind pass) ──────────────────────
// Called after error patterns cross a threshold — infers WHY the student
// keeps making the same error

async function inferStudentBelief(
  userId: string,
  correction: CorrectionResult
): Promise<void> {
  if (correction.error_categories.length === 0) return;

  const supabase = getServiceClient();

  // Only infer if we have a repeated error (count >= 3)
  const { data: topError } = await supabase
    .from('error_patterns')
    .select('error_type, count, examples')
    .eq('user_id', userId)
    .gte('count', 3)
    .order('count', { ascending: false })
    .limit(1)
    .single();

  if (!topError) return;

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_GPT_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  if (!endpoint || !apiKey || !deployment || !apiVersion) return;

  const examples = (topError.examples as Array<{ original: string; corrected: string }>).slice(0, 3);
  const exampleText = examples.map((e, i) =>
    `${i + 1}. "${e.original}" → "${e.corrected}"`
  ).join('\n');

  const prompt = `A German language student has made this error ${topError.count} times:
Error type: ${topError.error_type}
Examples:
${exampleText}

In one sentence, what does this student likely BELIEVE about German grammar that causes this error?
Format: "Student believes [specific misconception]."
Be specific and pedagogically insightful. Max 100 words.`;

  try {
    const response = await fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 100,
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) return;

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const belief = data.choices?.[0]?.message?.content?.trim();
    if (!belief || !belief.startsWith('Student believes')) return;

    // Store the inferred belief
    await supabase.from('student_beliefs').upsert({
      user_id: userId,
      topic: topError.error_type,
      belief_text: belief,
      confidence: Math.min(0.9, 0.3 + (topError.count * 0.1)),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,topic' });

  } catch {
    // Non-critical inference — silently ignore errors
  }
}

// ─── Persist correction to history ───────────────────────────────────────────
// Fire-and-forget from /api/tutor — gives students a reviewable correction log.

export async function saveCorrectionHistory(
  userId: string,
  workflow: string,
  result: CorrectionResult,
  sessionId?: string
): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from('corrections_history').insert({
      user_id: userId,
      workflow,
      original: result.original,
      corrected: result.corrected,
      error_type: result.error_type ?? null,
      error_categories: result.error_categories ?? [],
      cefr_estimate: result.cefr_estimate,
      confidence: result.confidence ?? null,
      explanation_de: result.explanation_de ?? null,
      session_id: sessionId ?? null,
    });
  } catch (err) {
    logger.error('student_model.history_save_failed', err, { userId, workflow });
  }
}

// ─── Build n8n workflow context payload ──────────────────────────────────────
// Called from /api/tutor to enrich the n8n webhook body with student context

export async function buildN8nContext(userId: string): Promise<{
  native_language: string;
  cefr_level: string;
  top_errors: string[];
  student_belief: string;
  correction_count: number;
  l1_prompt_note: string;
}> {
  try {
    const context = await fetchStudentContext(userId);
    return {
      native_language: context.native_language,
      cefr_level: context.cefr_estimate,
      top_errors: context.top_errors.map(e => `${e.error_type} (×${e.count})`),
      student_belief: context.top_beliefs[0]?.belief_text ?? '',
      correction_count: context.top_errors.reduce((sum, e) => sum + e.count, 0),
      l1_prompt_note: getL1PromptNote(context.native_language),
    };
  } catch (err) {
    logger.error('student_model.context_fetch_failed', err, { userId });
    return {
      native_language: 'English',
      cefr_level: 'A1',
      top_errors: [],
      student_belief: '',
      correction_count: 0,
      l1_prompt_note: '',
    };
  }
}
