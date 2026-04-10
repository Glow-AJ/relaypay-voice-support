import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 1. Ensure the user is actually 'pending' before allowing a resend
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('invite_status')
    .eq('email', email)
    .maybeSingle()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  if (agent.invite_status !== 'pending') {
    return NextResponse.json({ 
      error: 'Cannot resend invite: Agent has already accepted.' 
    }, { status: 400 })
  }

  // 2. Try the default native invite
  const { error: initialError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/agent/accept-invite`,
  })

  // 3. Fallback: If auth.users caught the expired user as 'already registered', safely delete the dormant auth row and re-trigger
  // Note: This is safe because 'public.agents' does not cascade delete from 'auth.users'
  if (initialError && initialError.message.includes('already been registered')) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
    const targetUser = users.find(u => u.email === email)
    
    if (targetUser) {
      await supabaseAdmin.auth.admin.deleteUser(targetUser.id)
      
      const { error: retryError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/agent/accept-invite`,
      })
      
      if (retryError) {
        return NextResponse.json({ error: retryError.message }, { status: 500 })
      }
    }
  } else if (initialError) {
    return NextResponse.json({ error: initialError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
