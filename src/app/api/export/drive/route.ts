import { NextRequest, NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createClient } from '@/lib/supabase/server';

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function isAdminRequest(req: NextRequest): boolean {
  return req.headers.get('x-internal-secret') === process.env.GWS_INTERNAL_SECRET;
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Allow both: authenticated user (profile export) OR n8n admin call (full backup)
  const isAdmin = isAdminRequest(req);
  let userId: string | null = null;

  if (!isAdmin) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    userId = user.id;
  }

  // ── 1. Parse request body ────────────────────────────────────────────────
  let body: { user_id?: string; month?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  // ★ SECURITY: Non-admin users can only export their own data
  if (!isAdmin && body.user_id && body.user_id !== userId) {
    return NextResponse.json({ error: 'Access denied: cannot export another user\'s data' }, { status: 403 });
  }
  const targetUserId = userId ?? body.user_id ?? null;
  const now = new Date();
  const monthLabel = body.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(`${monthLabel}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  // ── 2. Query corrections ────────────────────────────────────────────────
  let query = supabase
    .from('messages')
    .select('id, user_id, created_at, original_text, corrected_text, input_type, cefr_estimate, xp_awarded')
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', monthEnd.toISOString())
    .order('created_at', { ascending: true });

  if (targetUserId) {
    query = query.eq('user_id', targetUserId);
  }

  const { data: corrections, error: dbError } = await query;
  if (dbError) {
    return NextResponse.json({ error: 'Failed to fetch corrections' }, { status: 500 });
  }

  // ── 3. Build JSON content ────────────────────────────────────────────────
  const backupData = {
    generated_at: new Date().toISOString(),
    month: monthLabel,
    record_count: corrections?.length ?? 0,
    user_id: targetUserId ?? 'all',
    corrections: corrections ?? [],
  };

  const fileName = targetUserId
    ? `morodeutsch-backup-${targetUserId.slice(0, 8)}-${monthLabel}.json`
    : `morodeutsch-backup-${monthLabel}.json`;

  // ── 4. Write to temp file ────────────────────────────────────────────────
  const tmpPath = join(tmpdir(), fileName);
  writeFileSync(tmpPath, JSON.stringify(backupData, null, 2), 'utf8');

  // ── 5. Upload to Google Drive via gws ───────────────────────────────────
  let fileId: string;
  let webViewLink: string;

  try {
    const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
    const metadata = JSON.stringify({
      name: fileName,
      mimeType: 'application/json',
      ...(folderId ? { parents: [folderId] } : {}),
    });

    // gws drive files.create with multipart upload using --filePath flag
    const result = execFileSync('gws', [
      'drive', 'files.create',
      '--body', metadata,
      '--filePath', tmpPath,
      '--uploadType', 'multipart',
    ], { encoding: 'utf8', timeout: 30000 });

    const parsed = JSON.parse(result) as { id: string; webViewLink?: string };
    fileId = parsed.id;
    webViewLink = parsed.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;
  } catch (err: unknown) {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[export:drive] Failed to upload to Drive:', msg);
    return NextResponse.json({ error: 'Failed to upload to Drive' }, { status: 500 });
  } finally {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
  }

  // ── 6. Log backup event to Supabase ────────────────────────────────────
  try {
    await supabase.from('security_events').insert({
      event_type: 'drive_backup',
      user_id: targetUserId,
      metadata: { fileId, fileName, month: monthLabel, recordCount: backupData.record_count },
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-critical — don't fail the whole request
  }

  return NextResponse.json({
    success: true,
    fileId,
    fileName,
    webViewLink,
    month: monthLabel,
    recordCount: backupData.record_count,
  });
}
