import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString()

  try {
    const payload = await req.json()
    const messageType = payload.message?.type || payload.type

    console.log(`[VAPI Webhook ${timestamp}] Event type: "${messageType}"`)

    // ─── 1. end-of-call-report ───────────────────────────────────────────────
    // This is what Vapi sends to the SERVER URL after a call ends.
    // It contains the full conversation messages array.
    if (messageType === 'end-of-call-report') {
      const report = payload.message || payload
      const call = report.call || {}
      const metadata = call.metadata || call.assistantOverrides?.metadata || {}
      const conversationId = metadata.conversation_id || call.id

      console.log(`[VAPI Webhook] end-of-call-report: convId=${conversationId}`)

      if (!conversationId) {
        console.warn('[VAPI Webhook] end-of-call-report missing conversationId — skipping persist')
        return NextResponse.json({ handled: false, reason: 'no conversationId' })
      }

      const messages: Array<{ role: string; content: string }> = report.messages || report.transcript || []

      if (!messages.length) {
        console.warn('[VAPI Webhook] end-of-call-report had no messages array')
        return NextResponse.json({ handled: false, reason: 'no messages' })
      }

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      // Filter to only user/assistant messages (skip system/tool)
      const toInsert = messages
        .filter((m) => m.role === 'user' || m.role === 'bot' || m.role === 'assistant')
        .map((m) => ({
          conversation_id: conversationId,
          role: m.role === 'bot' ? 'assistant' : m.role,
          content: m.content || '',
          created_at: timestamp,
        }))

      if (toInsert.length === 0) {
        return NextResponse.json({ handled: false, reason: 'no user/assistant messages' })
      }

      const { error } = await supabaseAdmin.from('messages').insert(toInsert)

      if (error) {
        console.error('[VAPI Webhook] Supabase insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log(`[VAPI Webhook] Persisted ${toInsert.length} messages for conv ${conversationId}`)
      return NextResponse.json({ success: true, persisted: toInsert.length })
    }

    // ─── 2. transcript (streaming, per-utterance) ────────────────────────────
    // Vapi can also send individual final transcript events if configured.
    if (messageType === 'transcript') {
      const msg = payload.message || payload
      if (msg.transcriptType !== 'final') {
        return NextResponse.json({ handled: false, reason: 'partial transcript ignored' })
      }

      const call = msg.call || {}
      const metadata = call.metadata || call.assistantOverrides?.metadata || {}
      const conversationId = metadata.conversation_id || call.id

      if (!conversationId) {
        console.warn('[VAPI Webhook] transcript event missing conversationId')
        return NextResponse.json({ handled: false, reason: 'no conversationId' })
      }

      let role = msg.role
      if (role === 'bot') role = 'assistant'

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { error } = await supabaseAdmin.from('messages').insert({
        conversation_id: conversationId,
        role,
        content: msg.transcript || '',
        created_at: timestamp,
      })

      if (error) {
        console.error('[VAPI Webhook] Supabase insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log(`[VAPI Webhook] Persisted transcript utterance for conv ${conversationId}`)
      return NextResponse.json({ success: true, persisted: 1 })
    }

    // ─── 3. Other events — acknowledge but don't process ─────────────────────
    console.log(`[VAPI Webhook] Unhandled event type: ${messageType}`)
    return NextResponse.json({ handled: false, reason: `event type "${messageType}" not handled` })
  } catch (err: any) {
    console.error(`[VAPI Webhook] Global error:`, err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
