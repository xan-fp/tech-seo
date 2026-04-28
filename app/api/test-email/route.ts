import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const to = searchParams.get('to')

  // 1 — Check key exists
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return NextResponse.json({
      ok:    false,
      step:  'config',
      error: 'RESEND_API_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.',
    })
  }

  if (!to) {
    return NextResponse.json({
      ok:    false,
      step:  'config',
      error: 'Add ?to=your@email.com to this URL to send a test email.',
    })
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  // 2 — Try sending
  try {
    const resend = new Resend(key)
    const result = await resend.emails.send({
      from,
      to,
      subject: '✅ SEO Audit — email test',
      html: `<p>Email is working! Sent from <strong>${from}</strong>.</p>
             <p style="color:#6b7280;font-size:12px;">If you expected a different sender, set RESEND_FROM_EMAIL in your Vercel env vars.</p>`,
    })

    if ((result as { error?: unknown }).error) {
      return NextResponse.json({
        ok:    false,
        step:  'send',
        from,
        to,
        error: (result as { error: unknown }).error,
      })
    }

    return NextResponse.json({ ok: true, from, to, result })
  } catch (err) {
    return NextResponse.json({
      ok:    false,
      step:  'send',
      from,
      to,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
