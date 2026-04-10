import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { name, email, role } = await req.json()
  if (!name || !email || !role) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/agent/accept-invite`,
  })

  if (inviteError && !inviteError.message.includes('already been registered')) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  const { error: upsertError } = await supabaseAdmin
    .from('agents')
    .upsert(
      {
        name,
        email,
        role,
        is_available: true,
        invite_status: 'pending',
        invited_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
