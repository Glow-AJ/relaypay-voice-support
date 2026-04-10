import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString()
  
  try {
    const payload = await req.json()
    console.log(`[VAPI Webhook ${timestamp}] Received payload:`, JSON.stringify(payload, null, 2))

    const message = payload.message || {}
    
    // We only care about final transcripts to persist them in the DB
    if (message.type !== 'transcript' || message.transcriptType !== 'final') {
      console.log(`[VAPI Webhook ${timestamp}] Skipping non-final transcript message of type: ${message.type}`)
      return NextResponse.json({ handled: false, reason: 'Not a final transcript' })
    }

    const call = message.call || {}
    const transcript = message.transcript
    
    // Map role: Vapi might use 'bot' or 'assistant'. Our DB uses 'assistant'.
    let role = message.role // 'user' or 'bot' or 'assistant'
    if (role === 'bot') role = 'assistant'
    
    // Extract metadata. Vapi usually places it in call.metadata or assistantOverrides.metadata
    const metadata = call.metadata || call.assistantOverrides?.metadata || {}
    const conversationId = metadata.conversation_id || call.id
    
    console.log(`[VAPI Webhook ${timestamp}] Mapping: role=${role}, convId=${conversationId}, transcriptLen=${transcript?.length}`)

    if (!conversationId) {
      console.error(`[VAPI Webhook ${timestamp}] Error: Could not determine conversationId from payload.`)
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Log the message to Supabase
    const { error: insertError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: role,
        content: transcript,
        created_at: timestamp
      })

    if (insertError) {
      console.error(`[VAPI Webhook ${timestamp}] Supabase Insert Error:`, insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log(`[VAPI Webhook ${timestamp}] Success: Persisted transcript for conv ${conversationId}`)
    return NextResponse.json({ success: true, persisted: true })
  } catch (err: any) {
    console.error(`[VAPI Webhook ${timestamp}] Global Error:`, err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
