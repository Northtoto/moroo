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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      { status: 429 }
    );
  }

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

      formData.set('user_id', session.user.id);
      formData.set('session_id', sessionId);

      const result = await callN8nWorkflowWithFile(workflow, formData, session.access_token);
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
        user_id: session.user.id,
      }, session.access_token);

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
