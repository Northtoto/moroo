import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callN8nWorkflow, callN8nWorkflowWithFile } from '@/lib/n8n';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      // Audio file upload
      const formData = await request.formData();
      const workflow = formData.get('workflow') as string;
      formData.append('user_id', session.user.id);
      formData.append('session_id', formData.get('session_id') as string || '');

      const result = await callN8nWorkflowWithFile(workflow, formData, session.access_token);
      return NextResponse.json(result);
    } else {
      // JSON request (text or OCR)
      const body = await request.json();
      const { workflow, ...data } = body;

      const result = await callN8nWorkflow(workflow, {
        ...data,
        user_id: session.user.id,
      }, session.access_token);

      return NextResponse.json(result);
    }
  } catch (err) {
    console.error('Tutor API error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
