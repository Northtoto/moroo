// ─── Flashcard Review API ─────────────────────────────────────────────────────
// FSRS spaced repetition: update card state after each review.
// POST { card_id, rating: 1-4 } → updated due date + new FSRS state
// GET  → fetch due cards for today

import { NextResponse } from 'next/server';
import { withApiGuard, FlashcardReviewSchema } from '@/lib/api-guard';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { fsrs, generatorParameters, Rating, type Card, type FSRSParameters } from 'ts-fsrs';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key);
}

// ─── POST: submit a card review ───────────────────────────────────────────────

export const POST = withApiGuard(
  async (req, ctx) => {
    const { card_id, rating } = ctx.validatedBody as { card_id: string; rating: 1 | 2 | 3 | 4 };
    const userId = ctx.user!.id;
    const supabase = getServiceClient();

    // Fetch current card state
    const { data: reviewRow, error: fetchErr } = await supabase
      .from('card_reviews')
      .select('*')
      .eq('card_id', card_id)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !reviewRow) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Build FSRS card object from stored state
    const params: FSRSParameters = generatorParameters({ enable_fuzz: true });
    const f = fsrs(params);

    const card: Card = {
      due: new Date(reviewRow.due),
      stability: reviewRow.stability,
      difficulty: reviewRow.difficulty,
      elapsed_days: reviewRow.elapsed_days ?? 0,
      scheduled_days: reviewRow.scheduled_days ?? 0,
      reps: reviewRow.reps ?? 0,
      lapses: reviewRow.lapses ?? 0,
      state: reviewRow.state ?? 0,
      last_review: reviewRow.last_review ? new Date(reviewRow.last_review) : undefined,
      learning_steps: 0,
    };

    // Map 1-4 to FSRS Rating enum: 1=Again, 2=Hard, 3=Good, 4=Easy
    const ratingMap: Record<number, Rating> = {
      1: Rating.Again,
      2: Rating.Hard,
      3: Rating.Good,
      4: Rating.Easy,
    };

    const schedulingCards = f.repeat(card, new Date()) as unknown as Record<Rating, { card: Card }>;
    const updated = schedulingCards[ratingMap[rating]].card;

    // Persist updated FSRS state
    const { error: updateErr } = await supabase
      .from('card_reviews')
      .update({
        due: updated.due.toISOString(),
        stability: updated.stability,
        difficulty: updated.difficulty,
        elapsed_days: updated.elapsed_days,
        scheduled_days: updated.scheduled_days,
        reps: updated.reps,
        lapses: updated.lapses,
        state: updated.state,
        last_review: new Date().toISOString(),
      })
      .eq('card_id', card_id)
      .eq('user_id', userId);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update card' }, { status: 500 });
    }

    return NextResponse.json({
      next_due: updated.due.toISOString(),
      scheduled_days: updated.scheduled_days,
      stability: updated.stability,
    });
  },
  {
    requireAuth: true,
    rateLimit: { requests: 120, window: 60 },
    bodySchema: FlashcardReviewSchema,
  }
);

// ─── GET: fetch due cards ─────────────────────────────────────────────────────
// Auto-seeds the deck from vocabulary_bank when a new user has no cards yet.

export const GET = withApiGuard(
  async (_req, ctx) => {
    const userId = ctx.user!.id;
    const supabase = getServiceClient();

    const { data, error } = await supabase.rpc('get_due_cards', {
      p_user_id: userId,
      p_limit: 20,
    });

    if (error) {
      console.error('[flashcards:get] get_due_cards RPC error:', error);
      return NextResponse.json({ error: 'Failed to fetch due cards' }, { status: 500 });
    }

    // ── Auto-seed: new user has no cards yet ─────────────────────────────────
    // Detect a completely empty deck (not just "none due today") by checking
    // the total card count. If zero, seed from vocabulary_bank at their level.
    if (!data || data.length === 0) {
      const { count } = await supabase
        .from('card_reviews')
        .select('card_id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if ((count ?? 0) === 0) {
        // Fetch the user's current CEFR level from learning_state
        const { data: stateRow } = await supabase
          .from('learning_state')
          .select('cefr_estimate')
          .eq('user_id', userId)
          .single();

        const cefrLevel = stateRow?.cefr_estimate ?? 'A1';

        // Seed deck — idempotent, safe to call multiple times
        const { error: seedErr } = await supabase.rpc('seed_cards_from_bank', {
          p_user_id: userId,
          p_cefr: cefrLevel,
        });

        if (seedErr) {
          console.error('[flashcards:get] seed_cards_from_bank error:', seedErr);
          // Non-fatal: return empty deck rather than erroring
          return NextResponse.json({ cards: [], seeded: false });
        }

        // Re-fetch after seeding so first session loads cards immediately
        const { data: seededCards, error: refetchErr } = await supabase.rpc('get_due_cards', {
          p_user_id: userId,
          p_limit: 20,
        });

        if (refetchErr) {
          return NextResponse.json({ cards: [], seeded: true });
        }

        console.log(`[flashcards:get] Seeded ${seededCards?.length ?? 0} cards for new user ${userId} at level ${cefrLevel}`);
        return NextResponse.json({ cards: seededCards ?? [], seeded: true });
      }
    }

    return NextResponse.json({ cards: data ?? [] });
  },
  {
    requireAuth: true,
    rateLimit: { requests: 30, window: 60 },
  }
);
