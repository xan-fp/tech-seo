import { Resend } from 'resend'
import type { TeamMember, Ticket } from './types'
import { getFixGuide } from './fix-guide'

// Lazy-init so missing key doesn't crash at build time
function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

function ticketCode(id: string) {
  return `TKT-${id.slice(0, 8).toUpperCase()}`
}

function buildCsv(ticket: Ticket): string {
  const urls: string[] = Array.isArray(ticket.affected_urls) ? ticket.affected_urls : []
  const rows = urls.map(url => {
    const safeUrl   = `"${url.replace(/"/g, '""')}"`
    const safeIssue = `"${ticket.issue_type.replace(/"/g, '""')}"`
    return `${safeUrl},${safeIssue}`
  })
  return ['URL,Issue Type', ...rows].join('\r\n')
}

function buildHtml(ticket: Ticket, code: string): string {
  const guide = getFixGuide(ticket.issue_type)

  const stepsHtml = guide.steps
    .map(
      (step, i) =>
        `<tr>
          <td style="padding:6px 10px 6px 0;vertical-align:top;color:#6366f1;font-weight:700;white-space:nowrap;">${i + 1}.</td>
          <td style="padding:6px 0;color:#374151;line-height:1.6;">${step}</td>
        </tr>`,
    )
    .join('')

  const severityColor: Record<string, string> = {
    critical: '#dc2626',
    high:     '#ea580c',
    medium:   '#d97706',
    low:      '#65a30d',
  }
  const sev = ticket.severity ?? 'medium'

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;padding:24px 32px;">
            <p style="margin:0;color:#c7d2fe;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">SEO Audit Tool</p>
            <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;font-weight:700;line-height:1.3;">
              New SEO Issue Detected
            </h1>
          </td>
        </tr>

        <!-- Ticket meta -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <span style="display:inline-block;background:#eef2ff;color:#4f46e5;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;letter-spacing:.05em;">${code}</span>
                  <span style="display:inline-block;margin-left:8px;background:${severityColor[sev] ?? '#d97706'}22;color:${severityColor[sev] ?? '#d97706'};font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;text-transform:uppercase;">${sev}</span>
                </td>
              </tr>
              <tr>
                <td style="padding-top:10px;">
                  <h2 style="margin:0;font-size:17px;color:#111827;line-height:1.4;">${ticket.title}</h2>
                </td>
              </tr>
              <tr>
                <td style="padding-top:6px;">
                  <p style="margin:0;font-size:13px;color:#6b7280;">
                    ${ticket.affected_count} page${ticket.affected_count === 1 ? '' : 's'} affected &nbsp;·&nbsp; Source: ${ticket.source_tool ?? 'Manual'}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:20px 32px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>

        <!-- What is this -->
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">What is this?</p>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${guide.what}</p>
          </td>
        </tr>

        <!-- Why it matters -->
        <tr>
          <td style="padding:16px 32px 0;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">Why it matters</p>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${guide.why}</p>
          </td>
        </tr>

        <!-- How to fix -->
        <tr>
          <td style="padding:16px 32px 0;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">How to fix it</p>
            <table cellpadding="0" cellspacing="0" style="background:#f5f3ff;border-radius:8px;padding:12px 16px;width:100%;">
              ${stepsHtml}
            </table>
          </td>
        </tr>

        <!-- Who owns this -->
        <tr>
          <td style="padding:16px 32px 0;">
            <table cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.08em;">Who does this</p>
                  <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">${guide.owner}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CSV note -->
        <tr>
          <td style="padding:16px 32px 0;">
            <table cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;width:100%;">
              <tr>
                <td>
                  <p style="margin:0;font-size:13px;color:#166534;line-height:1.5;">
                    📎 <strong>Affected URLs attached</strong> — open the CSV in Google Sheets to see every page that needs this fix.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #e5e7eb;margin-top:24px;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
              This email was sent automatically by your SEO Audit tool when this ticket was approved.<br>
              Ticket ID: ${code}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Send an approval email to every team member in the ticket's owner bucket.
 * Silently skips if RESEND_API_KEY is not set.
 */
export async function sendApprovalEmail(
  ticket:     Ticket,
  recipients: TeamMember[],
): Promise<void> {
  const resend = getResend()
  if (!resend || recipients.length === 0) return

  const from = process.env.RESEND_FROM_EMAIL ?? 'SEO Audit <onboarding@resend.dev>'
  const code = ticketCode(ticket.id)
  const csv  = buildCsv(ticket)

  const safeName = ticket.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60)

  await resend.emails.send({
    from,
    to:      recipients.map(m => m.email),
    subject: `‼️ New SEO Issue - ${code} - ${ticket.title}`,
    html:    buildHtml(ticket, code),
    attachments: [
      {
        filename: `${safeName}-affected-urls.csv`,
        content:  Buffer.from(csv).toString('base64'),
      },
    ],
  })
}
