import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { createClient } from '@/lib/supabase/server';
import { withApiGuard } from '@/lib/api-guard';

// ─── Build RFC 2822 MIME message ─────────────────────────────────────────────
function buildMimeMessage(to: string, subject: string, html: string, from: string): string {
  const boundary = `----=_Part_${Date.now()}`;
  const mime = [
    `From: Morodeutsch <${from}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(html).toString('base64'),
    `--${boundary}--`,
  ].join('\r\n');
  return mime;
}

// ─── Weekly email HTML template ───────────────────────────────────────────────
function buildWeeklyEmailHtml(body: {
  name: string;
  streak: number;
  corrections: number;
  xp: number;
  mistakes?: Array<{ original: string; corrected: string; category: string }>;
}): string {
  const { name, streak, corrections, xp, mistakes = [] } = body;

  const mistakesHtml = mistakes.slice(0, 3).map((m, i) => `
    <tr>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(245,158,11,0.15); font-size:13px; color:#e2c97e;">
        ${i + 1}. <span style="text-decoration:line-through; color:#ef4444;">${m.original}</span>
      </td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(245,158,11,0.15); font-size:13px; color:#4ade80;">
        → ${m.corrected}
      </td>
      <td style="padding:10px 8px; border-bottom:1px solid rgba(245,158,11,0.15); font-size:11px; color:#94a3b8;">
        ${m.category}
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0c12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <tr>
      <td>
        <!-- Header -->
        <table width="100%" style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.08));border:1px solid rgba(245,158,11,0.3);border-radius:20px 20px 0 0;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <!-- Logo text mark -->
                    <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;">
                      <span style="font-size:22px;font-weight:900;color:#f59e0b;letter-spacing:-0.5px;font-family:Georgia,serif;">MARODEUTSCH</span>
                      <span style="font-size:8px;color:#f59e0b;opacity:0.6;letter-spacing:2px;">AI TUTOR</span>
                    </div>
                    <p style="margin:0;font-size:13px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Deine Woche auf Morodeutsch 🇩🇪</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <table width="100%" style="background:#111827;border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 20px 20px;overflow:hidden;">
          <tr>
            <td style="padding:32px;">

              <h2 style="margin:0 0 8px;font-size:20px;color:#f1f5f9;font-weight:700;">
                Hallo ${name}! 👋
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;">
                Hier ist dein persönlicher Wochenbericht. Gut gemacht!
              </p>

              <!-- Stats -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="33%" style="padding:4px;">
                    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:16px;text-align:center;">
                      <div style="font-size:28px;font-weight:800;color:#f59e0b;font-family:monospace;">${streak}</div>
                      <div style="font-size:11px;color:#94a3b8;margin-top:4px;">🔥 Tage Streak</div>
                    </div>
                  </td>
                  <td width="33%" style="padding:4px;">
                    <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:12px;padding:16px;text-align:center;">
                      <div style="font-size:28px;font-weight:800;color:#818cf8;font-family:monospace;">${corrections}</div>
                      <div style="font-size:11px;color:#94a3b8;margin-top:4px;">✏️ Korrekturen</div>
                    </div>
                  </td>
                  <td width="33%" style="padding:4px;">
                    <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:12px;padding:16px;text-align:center;">
                      <div style="font-size:28px;font-weight:800;color:#34d399;font-family:monospace;">${xp}</div>
                      <div style="font-size:11px;color:#94a3b8;margin-top:4px;">⭐ XP verdient</div>
                    </div>
                  </td>
                </tr>
              </table>

              ${mistakes.length > 0 ? `
              <!-- Top mistakes -->
              <h3 style="margin:0 0 12px;font-size:14px;color:#f59e0b;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
                🧠 Top 3 Korrekturen dieser Woche
              </h3>
              <table width="100%" style="border-collapse:collapse;margin-bottom:28px;background:rgba(0,0,0,0.2);border-radius:10px;overflow:hidden;">
                ${mistakesHtml}
              </table>` : ''}

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="text-align:center;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/tutor"
                       style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#0a0c12;font-weight:800;font-size:15px;padding:14px 36px;border-radius:12px;text-decoration:none;letter-spacing:0.02em;">
                      Weiterüben →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <p style="margin:0;font-size:11px;color:#475569;text-align:center;border-top:1px solid rgba(255,255,255,0.05);padding-top:20px;">
                Morodeutsch AI German Tutor &nbsp;·&nbsp; Diese E-Mail wurde automatisch generiert
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export const POST = withApiGuard(
  async (req: NextRequest, ctx) => {
    const user = ctx.user!;
    const supabase = await createClient();

    // 1. Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Parse body
    let body: {
      to?: string;
      subject?: string;
      html?: string;
      // Structured data for the template
      name?: string;
      streak?: number;
      corrections?: number;
      xp?: number;
      mistakes?: Array<{ original: string; corrected: string; category: string }>;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const to = body.to;
    if (!to) {
      return NextResponse.json({ error: 'Missing required field: to' }, { status: 400 });
    }

    const from = process.env.GMAIL_FROM_ADDRESS ?? 'noreply@morodeutsch.com';

    // 3. Build HTML (use provided html or generate from template data)
    const html = body.html ?? buildWeeklyEmailHtml({
      name: body.name ?? 'Student',
      streak: body.streak ?? 0,
      corrections: body.corrections ?? 0,
      xp: body.xp ?? 0,
      mistakes: body.mistakes ?? [],
    });

    const subject = body.subject ?? 'Deine Woche auf Morodeutsch 🇩🇪';

    // 4. Build MIME message + base64url encode
    const mimeMessage = buildMimeMessage(to, subject, html, from);
    const rawBase64 = Buffer.from(mimeMessage).toString('base64url');

    // 5. Send via gws Gmail API
    try {
      const gwsBody = JSON.stringify({ raw: rawBase64 });
      const result = execSync(
        `gws gmail users.messages.send --userId me --body '${gwsBody.replace(/'/g, "'\\''")}'`,
        { encoding: 'utf8', timeout: 15000 }
      );

      const parsed = JSON.parse(result);
      return NextResponse.json({
        success: true,
        messageId: parsed.id ?? parsed.messageId ?? 'sent',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[send-weekly-email] gws error:', message);
      return NextResponse.json(
        { error: 'Failed to send email via Gmail API', detail: message },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: true,
    rateLimit: { requests: 10, window: 60 },
  }
);
