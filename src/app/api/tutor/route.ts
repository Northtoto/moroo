import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callN8nWorkflow, callN8nWorkflowWithFile } from '@/lib/n8n';

const ALLOWED_WORKFLOWS = ['text-correction', 'audio-correction', 'ocr-correction'] as const;

// Simple in-process rate limiter: max 20 requests per user per 60 seconds
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function workflowToInputType(workflow: string): 'text' | 'audio' | 'image' {
  if (workflow === 'audio-correction') return 'audio';
  if (workflow === 'ocr-correction') return 'image';
  return 'text';
}

/** Persist correction result to the messages table (best-effort, never blocks response). */
async function saveCorrection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string | null,
  inputType: 'text' | 'audio' | 'image',
  originalText: string,
  result: Record<string, unknown>,
) {
  try {
    await supabase.from('messages').insert({
      user_id: userId,
      session_id: sessionId,
      input_type: inputType,
      original_content: originalText,
      corrected_content: typeof result.corrected === 'string' ? result.corrected : null,
      explanation: typeof result.explanation === 'string' ? result.explanation : null,
      metadata: {
        transcription: result.transcription ?? null,
      },
    });

    // Best-effort streak increment (calls the DB function from migration 004)
    await supabase.rpc('increment_streak', { p_user_id: userId } as never);
  } catch (err) {
    // Never let a DB write failure break the user-facing response
    console.error('Failed to save correction to DB:', err);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // SECURITY: getUser() makes a live server-side verification with Supabase.
  // getSession() only reads the local cookie and can be forged.
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // SECURITY: Verify the user is approved before allowing any AI usage.
  // Middleware protects the /tutor page but not this API route directly.
  const { data: profile } = await supabase
    .from('profiles')
    .select('approval_status')
    .eq('id', user.id)
    .single();

  if (profile?.approval_status !== 'approved') {
    return NextResponse.json({ error: 'Account not approved' }, { status: 403 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      { status: 429 }
    );
  }

  // Access token is still retrieved from session (read-only, not used for auth validation).
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? '';

  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      // Audio file upload
      const formData = await request.formData();
      const workflow = formData.get('workflow');
      const sessionId = formData.get('session_id');

      if (!workflow || typeof workflow !== 'string') {
        return NextResponse.json(
          { error: 'Missing or invalid workflow parameter' },
          { status: 400 }
        );
      }

      if (!ALLOWED_WORKFLOWS.includes(workflow as typeof ALLOWED_WORKFLOWS[number])) {
        return NextResponse.json({ error: 'Invalid workflow' }, { status: 400 });
      }

      if (!sessionId || typeof sessionId !== 'string') {
        return NextResponse.json(
          { error: 'Missing or invalid session_id parameter' },
          { status: 400 }
        );
      }

      formData.set('user_id', user.id);
      formData.set('session_id', sessionId);

      const result = await callN8nWorkflowWithFile(workflow, formData, accessToken);

      // Persist to DB (non-blocking)
      const inputType = workflowToInputType(workflow);
      const originalText = typeof result.transcription === 'string' ? result.transcription : '[audio upload]';
      saveCorrection(supabase, user.id, sessionId, inputType, originalText, result);

      return NextResponse.json(result);
    } else {
      // JSON request (text or OCR)
      const body = await request.json();
      const { workflow, ...data } = body;

      if (!workflow || typeof workflow !== 'string') {
        return NextResponse.json(
          { error: 'Missing or invalid workflow parameter' },
          { status: 400 }
        );
      }

      if (!ALLOWED_WORKFLOWS.includes(workflow as typeof ALLOWED_WORKFLOWS[number])) {
        return NextResponse.json({ error: 'Invalid workflow' }, { status: 400 });
      }

      const result = await callN8nWorkflow(workflow, {
        ...data,
        user_id: user.id,
      }, accessToken);

      // Persist to DB (non-blocking)
      const inputType = workflowToInputType(workflow);
      const originalText = typeof data.text === 'string' ? data.text
        : typeof data.ocr_text === 'string' ? data.ocr_text
        : '';
      saveCorrection(supabase, user.id, null, inputType, originalText, result);

      return NextResponse.json(result);
    }
  } catch (err) {
    console.error('Tutor API error:', err);

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process request. Please try again.' },
      { status: 500 }
    );
  }
}
