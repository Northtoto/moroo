import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function verifyInternalSecret(req: NextRequest): boolean {
  return req.headers.get('x-internal-secret') === process.env.GWS_INTERNAL_SECRET;
}

function buildMimeMessage(to: string, subject: string, html: string, from: string): string {
  const boundary = `----=_Part_${Date.now()}`;
  return [
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
}

function buildStreakEmailHtml(
  name: string,
  streak: number,
  quickTask: string,
  appUrl: string
): string {
  const xpAtRisk = streak * 10;
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0c12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <tr>
      <td>
        <!-- Flame header -->
        <table width="100%" style="background:linear-gradient(135deg,rgba(239,68,68,0.2),rgba(245,158,11,0.15));border:1px solid rgba(239,68,68,0.35);border-radius:20px 20px 0 0;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;text-align:center;">
              <div style="font-size:52px;line-height:1;">🔥</div>
              <h1 style="margin:8px 0 4px;font-size:22px;color:#fca5a5;font-weight:800;">
                Dein Streak endet in 4 Stunden!
              </h1>
              <p style="margin:0;font-size:13px;color:#94a3b8;">
                MARODEUTSCH &nbsp;·&nbsp; Streak-Erinnerung
              </p>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <table width="100%" style="background:#111827;border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 20px 20px;">
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:18px;color:#f1f5f9;">Hallo ${name}! 👋</h2>

              <!-- Streak badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="text-align:center;">
                    <div style="display:inline-block;background:rgba(245,158,11,0.12);border:2px solid rgba(245,158,11,0.4);border-radius:16px;padding:20px 40px;">
                      <div style="font-size:48px;font-weight:900;color:#f59e0b;font-family:monospace;line-height:1;">${streak}</div>
                      <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Tage Streak 🔥</div>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size:14px;color:#cbd5e1;margin:0 0 8px;">
                Du hast heute noch keine Einreichung gemacht. Dein Streak und
                <strong style="color:#f59e0b;">${xpAtRisk} XP Fortschritt</strong> sind in Gefahr!
              </p>

              <!-- Quick task -->
              <div style="background:rgba(16,185,129,0.08);border-left:3px solid #34d399;border-radius:0 10px 10px 0;padding:16px 20px;margin:20px 0;">
                <div style="font-size:12px;color:#34d399;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">⚡ 2-Minuten-Aufgabe</div>
                <p style="margin:0;font-size:14px;color:#e2e8f0;">${quickTask}</p>
              </div>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="text-align:center;">
                    <a href="${appUrl}/tutor"
                       style="display:inline-block;background:linear-gradient(135deg,#ef4444,#f59e0b);color:#fff;font-weight:800;font-size:16px;padding:16px 40px;border-radius:12px;text-decoration:none;">
                      Jetzt Streak retten! 🚀
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What you'd lose -->
              <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px;margin-bottom:24px;">
                <div style="font-size:12px;color:#fca5a5;font-weight:700;margin-bottom:8px;">Was du verlierst, wenn du heute nicht übst:</div>
                <div style="font-size:13px;color:#94a3b8;">
                  🔥 ${streak}-Tage-Streak geht auf 0 zurück<br>
                  ⭐ ${xpAtRisk} XP Tages-Bonus entfällt<br>
                  🏅 Streak-Abzeichen Fortschritt unterbrochen
                </div>
              </div>

              <!-- Footer -->
              <p style="margin:0;font-size:11px;color:#475569;text-align:center;border-top:1px solid rgba(255,255,255,0.05);padding-top:16px;">
                Morodeutsch AI German Tutor &nbsp;·&nbsp; Diese Erinnerung wird täglich um 20:00 Uhr gesendet
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

export async function POST(req: NextRequest) {
  if (!verifyInternalSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    to?: string;
    subject?: string;
    html?: string;
    name?: string;
    streak?: number;
    quick_task?: string;
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const name = body.name ?? 'Student';
  const streak = body.streak ?? 1;

  const quickTask = body.quick_task ?? (
    streak < 5
      ? 'Schreib einen einfachen deutschen Satz, z.B.: "Heute lerne ich Deutsch."'
      : streak < 14
      ? 'Beschreib deinen Tag auf Deutsch in 2–3 Sätzen!'
      : 'Schreib einen kurzen Absatz auf Deutsch über ein beliebiges Thema.'
  );

  const html = body.html ?? buildStreakEmailHtml(name, streak, quickTask, appUrl);
  const subject = body.subject ?? `🔥 Dein ${streak}-Tage-Streak endet in 4 Stunden, ${name}!`;

  const mimeMessage = buildMimeMessage(to, subject, html, from);
  const rawBase64 = Buffer.from(mimeMessage).toString('base64url');

  try {
    const gwsBody = JSON.stringify({ raw: rawBase64 });
    // Use execFile (array args) — never spawns a shell, immune to injection
    const { stdout } = await execFileAsync(
      'gws',
      ['gmail', 'users.messages.send', '--userId', 'me', '--body', gwsBody],
      { encoding: 'utf8', timeout: 15000 }
    );
    const parsed = JSON.parse(stdout);
    return NextResponse.json({ success: true, messageId: parsed.id ?? 'sent' });
  } catch (err: unknown) {
    // Do NOT expose err.message — it may contain server internals / stderr
    console.error('[send-streak-email] gws error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'Failed to send streak email' },
      { status: 500 }
    );
  }
}
