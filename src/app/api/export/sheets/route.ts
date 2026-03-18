import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { createClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Correction {
  created_at: string;
  original_text: string;
  corrected_text: string;
  input_type: string;
  cefr_estimate: string | null;
  xp_awarded: number | null;
}

// ─── Helper: run gws command safely ──────────────────────────────────────────
function gws(args: string): unknown {
  const output = execSync(`gws ${args}`, {
    encoding: 'utf8',
    timeout: 20000,
  });
  return JSON.parse(output);
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Auth — only authenticated users can export their own data
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch user's corrections from Supabase
  const { data: corrections, error: dbError } = await supabase
    .from('messages')
    .select('created_at, original_text, corrected_text, input_type, cefr_estimate, xp_awarded')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1000) as { data: Correction[] | null; error: unknown };

  if (dbError) {
    return NextResponse.json({ error: 'Failed to fetch corrections' }, { status: 500 });
  }

  const rows = corrections ?? [];

  // 3. Get user display name for the sheet title
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Student';
  const title = `Morodeutsch — ${displayName} — Fortschritte`;

  // 4. Create Google Sheet via gws
  let spreadsheetId: string;
  try {
    const createBody = JSON.stringify({
      properties: { title },
    });
    const created = gws(
      `sheets spreadsheets.create --body '${createBody.replace(/'/g, "'\\''")}'`
    ) as { spreadsheetId: string };
    spreadsheetId = created.spreadsheetId;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[export:sheets] Failed to create sheet:', msg);
    return NextResponse.json({ error: 'Failed to create Google Sheet' }, { status: 500 });
  }

  // 5. Build data values (header + rows)
  const headerRow = ['Datum', 'Original', 'Korrigiert', 'Typ', 'CEFR-Stufe', 'XP verdient'];
  const dataRows = rows.map((c) => [
    new Date(c.created_at).toLocaleDateString('de-DE'),
    c.original_text ?? '',
    c.corrected_text ?? '',
    c.input_type ?? 'text',
    c.cefr_estimate ?? '—',
    String(c.xp_awarded ?? 0),
  ]);

  const values = [headerRow, ...dataRows];

  // 6. Write data to Sheet1
  try {
    const updateBody = JSON.stringify({ values });
    gws(
      `sheets spreadsheets.values.update --spreadsheetId ${spreadsheetId} --range "Sheet1!A1" --valueInputOption RAW --body '${updateBody.replace(/'/g, "'\\''")}'`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[export:sheets] Failed to write sheet data:', msg);
    return NextResponse.json({
      error: 'Sheet created but failed to write data',
      spreadsheetId,
    }, { status: 500 });
  }

  // 7. Apply amber header formatting via batchUpdate
  try {
    const formatBody = JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.961, green: 0.620, blue: 0.043 },
                textFormat: { bold: true, foregroundColor: { red: 0.039, green: 0.047, blue: 0.071 } },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 6 },
          },
        },
      ],
    });
    gws(
      `sheets spreadsheets.batchUpdate --spreadsheetId ${spreadsheetId} --body '${formatBody.replace(/'/g, "'\\''")}'`
    );
  } catch {
    // Formatting is best-effort — don't fail the whole request
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return NextResponse.json({
    success: true,
    spreadsheetId,
    spreadsheetUrl,
    rowCount: rows.length,
    title,
  });
}
