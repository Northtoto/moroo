// ─── Save vocabulary card ─────────────────────────────────────────────────────
// POST { german_word, english_translation, cefr_level, topic_tags? }
// Upserts into vocabulary_cards + creates initial card_review row (FSRS state)

import { NextRequest, NextResponse } from 'next/server';
import { withApiGuard } from '@/lib/api-guard';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createEmptyCard } from 'ts-fsrs';
import { z } from 'zod';

const SaveSchema = z.object({
  german_word: z.string().min(1).max(100),
  english_translation: z.string().min(1).max(200),
  cefr_level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  topic_tags: z.array(z.string()).optional().default([]),
});

export const POST = withApiGuard(
  async (_req: NextRequest, ctx) => {
    const { german_word, english_translation, cefr_level, topic_tags } =
      ctx.validatedBody as z.infer<typeof SaveSchema>;

    const userId = ctx.user!.id;
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert vocabulary card
    const { data: card, error: cardErr } = await supabase
      .from('vocabulary_cards')
      .upsert({
        user_id: userId,
        german_word,
        english_translation,
        cefr_level,
        topic_tags,
      }, { onConflict: 'user_id,german_word' })
      .select('id')
      .single();

    if (cardErr || !card) {
      return NextResponse.json({ error: 'Failed to save card' }, { status: 500 });
    }

    // Create initial FSRS review state if not exists
    const emptyCard = createEmptyCard(new Date());
    await supabase
      .from('card_reviews')
      .upsert({
        card_id: card.id,
        user_id: userId,
        due: emptyCard.due.toISOString(),
        stability: emptyCard.stability,
        difficulty: emptyCard.difficulty,
        elapsed_days: emptyCard.elapsed_days,
        scheduled_days: emptyCard.scheduled_days,
        reps: emptyCard.reps,
        lapses: emptyCard.lapses,
        state: emptyCard.state,
      }, { onConflict: 'card_id,user_id' });

    return NextResponse.json({ saved: true, card_id: card.id });
  },
  {
    requireAuth: true,
    rateLimit: { requests: 60, window: 60 },
    bodySchema: SaveSchema,
  }
);
