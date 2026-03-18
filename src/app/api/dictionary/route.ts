import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dictionary?q=lauf&cefr=A1,A2&limit=20
 *
 * Fuzzy German word search powered by pg_trgm similarity.
 * Returns words sorted by: exact match → prefix match → trigram similarity.
 *
 * Query params:
 *   q      — search query (required, min 2 chars)
 *   cefr   — comma-separated CEFR levels to filter (optional: A1,A2,B1,B2,C1,C2)
 *   limit  — max results (default: 20, max: 50)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q')?.trim();
  const cefrParam = searchParams.get('cefr');
  const limitParam = parseInt(searchParams.get('limit') ?? '20', 10);

  // Validate query
  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters', results: [] },
      { status: 400 }
    );
  }

  // Sanitize limit
  const limit = Math.min(Math.max(limitParam, 1), 50);

  // Parse optional CEFR filter
  const cefrFilter = cefrParam
    ? cefrParam.split(',').map(l => l.trim().toUpperCase()).filter(l =>
        ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(l)
      )
    : null;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('search_dictionary', {
      p_query: query,
      p_limit: limit,
      p_cefr: cefrFilter,
    });

    if (error) {
      console.error('[dictionary] RPC error:', error);
      return NextResponse.json(
        { error: 'Suche fehlgeschlagen', results: [] },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        query,
        results: data ?? [],
        count: data?.length ?? 0,
      },
      {
        headers: {
          // Cache for 60s on CDN — dictionary data is static
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    console.error('[dictionary] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten', results: [] },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dictionary/word?w=Haus
 * Returns full detail for a single word.
 */
export async function POST(request: NextRequest) {
  try {
    const { word } = await request.json();

    if (!word || typeof word !== 'string') {
      return NextResponse.json({ error: 'word is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_word_detail', {
      p_german_word: word.trim(),
    });

    if (error) {
      console.error('[dictionary:detail] RPC error:', error);
      return NextResponse.json({ error: 'Wort nicht gefunden' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Wort nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ word: data[0] });
  } catch (err) {
    console.error('[dictionary:detail] Unexpected error:', err);
    return NextResponse.json({ error: 'Ein Fehler ist aufgetreten' }, { status: 500 });
  }
}
