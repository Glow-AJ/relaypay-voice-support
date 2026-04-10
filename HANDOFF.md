# RelayPay Voice Customer Support Agent — Project Handoff

> **Last updated:** 2026-04-10  
> **Repo:** `Glow-AJ/relaypay-voice-support`  
> **Live deploy:** Vercel (auto-deploys from `main`)  
> **Read CLAUDE.md first** — it has all credentials, env vars, MCP server config, and architecture.

---

## What Is Built and Working

### Frontend (Next.js 14, App Router, TypeScript, Tailwind CSS v4)

| Surface | URL | Status |
|---------|-----|--------|
| Public chat (voice + text) | `/` | ✅ Built, VAPI wired |
| Admin login | `/admin/login` | ✅ Working |
| Admin dashboard | `/admin` | ✅ Working |
| Admin knowledge base | `/admin/knowledge-base` | ✅ Working |
| Admin escalations queue | `/admin/escalations` | ✅ Working |
| Admin conversations viewer | `/admin/conversations` | ✅ Working |
| Admin agents roster | `/admin/agents` | ✅ Working |
| Forgot password | `/admin/forgot-password` | ✅ Working |
| Reset password | `/admin/reset-password` | ✅ Working |
| Agent portal | `/agent` | ✅ Working |
| Agent accept invite | `/agent/accept-invite` | ✅ Working |

**All pages are mobile/tablet/desktop responsive.**

### Auth Flow

- **Admins:** Sign in at `/admin/login` with email + password (Supabase Auth). Middleware (`frontend/src/app/admin/proxy.ts`) protects `/admin/*` routes.
- **Agents (human support staff):** Admin invites via `/admin/agents` → agent receives email → clicks link → sets password at `/agent/accept-invite` → routed to `/agent` dashboard.
- **Login routing:** After sign-in, the login page checks if `user_id` matches an agents row — if yes, routes to `/agent`; otherwise to `/admin`.
- **Forgot password:** `/admin/forgot-password` → Supabase sends reset email → user lands on `/admin/reset-password` → page waits for `PASSWORD_RECOVERY` auth event → form shows → password updated → sign out → login with success banner.

### Agent Invite Flow (critical detail)

1. Admin clicks "Add Agent" at `/admin/agents`, fills name/email/role
2. Frontend calls `POST /api/admin/invite-agent` (server route, uses `SUPABASE_SERVICE_ROLE_KEY`)
3. Supabase Auth sends invite email; agents row inserted with `invite_status: 'pending'`
4. Agent clicks email link → lands on `/agent/accept-invite`
5. Page picks up Supabase session from URL hash (handled by `createBrowserClient` automatically)
6. Agent sets password → `supabase.auth.updateUser({ password })` → agents row updated: `user_id = auth.uid(), invite_status = 'accepted'`
7. Redirected to `/agent` dashboard

**RLS policies on agents table (applied via Supabase migration):**
```sql
CREATE POLICY "authenticated_read_agents" ON agents
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "agents_update_own_row" ON agents
  FOR UPDATE TO authenticated
  USING (email = auth.email())
  WITH CHECK (email = auth.email());
```

**If an agent shows "No agent profile found":** Their agents row has `user_id = NULL` (the UPDATE failed before RLS policies were in place). Admin should click **Resend Invite** on their card → agent clicks new link → sets password → agents row is now updated correctly.

### VAPI Voice Integration

**Files:**
- `frontend/src/app/page.tsx` — main public page, VAPI SDK init + all voice/text logic
- `frontend/src/components/chat/VoiceButton.tsx` — mic button (5 states: idle/connecting/listening/speaking/error)
- `frontend/src/components/chat/TranscriptDisplay.tsx` — live partial + final transcript display
- `frontend/src/components/VapiErrorBoundary.tsx` — React error boundary wrapping voice controls

**VAPI env vars needed in `frontend/.env.local`:**
```
NEXT_PUBLIC_VAPI_WEB_TOKEN=<public key from dashboard.vapi.ai>
NEXT_PUBLIC_VAPI_ASSISTANT_ID=<assistant ID from dashboard.vapi.ai>
```

**Key implementation details:**
- `voiceStatusRef` pattern: `useRef` mirrors `voiceStatus` state so real-time Supabase subscription callbacks can read the current voice status without stale closure issues
- Error handler calls `vapiRef.current?.stop()` to clean up Daily.co WebRTC connection before resetting status
- Message filter: only `role === 'user'` or `role === 'assistant'` messages shown in chat thread (prevents system prompt and tool_calls from appearing)
- Voice escalation detection: real-time subscription checks `action_taken === 'escalated'` AND `voiceStatusRef.current` is active → shows EscalationModal overlaid on live call

---

## What Still Needs To Be Done

### 1. n8n: `relaypay-show-escalation-form` workflow — CRITICAL

This is the most important remaining fix. Without it:
- VAPI errors after calling the escalation form tool (no valid tool result returned)
- "Page couldn't load" error overlay appears
- EscalationModal never shows during voice calls

**In the n8n dashboard, on the `relaypay-show-escalation-form` workflow:**

**Change 1 — Webhook node:** Response Mode → change from "Respond Immediately" to **"Using 'Respond to Webhook' Node"**

**Change 2 — Code node (Flatten):** Replace with:
```javascript
const body = $input.first().json.body ?? $input.first().json;
let toolCallId = null, reason = '', category = 'other', conversation_id = null;

if (body.message?.type === 'tool-calls') {
  const toolCall = body.message.toolCallList?.[0] ?? body.message.toolCalls?.[0];
  toolCallId = toolCall?.id ?? null;
  const p = toolCall?.function?.arguments ?? {};
  reason = p.escalationReason ?? '';
  category = p.escalationCategory ?? 'other';
  const meta = body.message.call?.assistantOverrides?.metadata ?? {};
  conversation_id = meta.conversation_id ?? null;
} else {
  reason = body.escalationReason ?? '';
  category = body.escalationCategory ?? 'other';
  conversation_id = body.conversation_id ?? null;
}

return [{ json: { toolCallId, reason, category, conversation_id } }];
```

**Change 3 — Add "Respond to Webhook" node** after the Supabase POST:
- Respond With: JSON
- Response Body (expression mode):
```json
{
  "results": [{
    "toolCallId": "{{ $('Flatten').first().json.toolCallId }}",
    "result": "Escalation form is now showing on the customer's screen. Tell them to fill it in with their name, email, and preferred appointment time. Wait for them to submit before continuing."
  }]
}
```
Replace `Flatten` with your actual code node name.

Wire: Webhook → Code → HTTP POST to Supabase → Respond to Webhook

---

### 2. n8n: `relaypay-voice-events` workflow — role filter

Without this fix, VAPI's end-of-call transcript includes messages with `role: 'system'` (the system prompt — shows as a wall of text in chat) and `role: 'tool_calls'` (violates Supabase `messages_role_check` constraint).

**In the voice events workflow, before the "Save Transcript" HTTP POST to Supabase:**

Add an **IF node** with condition:
```
{{ ['user', 'assistant'].includes($json.role) && ($json.transcript ?? '').trim().length > 0 }}
```
- TRUE branch → save to Supabase
- FALSE branch → no-op (end)

---

### 3. Gmail / email notifications

The booking workflow has a "Notify Support Team" Gmail node that currently fails because Gmail OAuth2 is not configured in n8n.

**In n8n → Settings → Credentials → Add → Gmail OAuth2 → follow OAuth flow.**

Then in the booking workflow's notification node, select the Gmail credential.

---

### 4. Knowledge Base — seed with RelayPay content

The KB is empty. Admin should add articles via `/admin/knowledge-base`. After adding, the embedding sync workflow (`/relaypay-kb-sync`) must be triggered for each article so the content is vectorised and searchable.

Categories to cover: fees, onboarding, payouts, invoicing, compliance, general, troubleshooting.

---

### 5. VAPI assistant — verify system prompt and tools

At `dashboard.vapi.ai`, open the assistant and confirm:
- **3 tools registered:** `search_knowledge_base`, `book_support_call`, `show_escalation_form`
- `show_escalation_form` Server URL = `https://cohort2pod2.app.n8n.cloud/webhook/relaypay-show-escalation-form`
- Model is `gpt-4o` (not `gpt-4o-mini`)
- Server URL (for transcripts) = `https://cohort2pod2.app.n8n.cloud/webhook/relaypay-voice-events`

---

## File Map — Key Files

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx                          ← Public: VAPI voice + text chat
│   │   ├── admin/
│   │   │   ├── proxy.ts                      ← Auth middleware (protects /admin/*)
│   │   │   ├── layout.tsx                    ← Sidebar nav + mobile hamburger menu
│   │   │   ├── page.tsx                      ← Dashboard: stats + recent escalations
│   │   │   ├── login/page.tsx                ← Supabase auth + agent routing
│   │   │   ├── forgot-password/page.tsx      ← Reset email request
│   │   │   ├── reset-password/page.tsx       ← New password form (waits for RECOVERY event)
│   │   │   ├── knowledge-base/page.tsx       ← KB CRUD + embedding trigger
│   │   │   ├── escalations/page.tsx          ← Queue + detail + status update + agent assign
│   │   │   ├── conversations/page.tsx        ← Conversation list + message thread viewer
│   │   │   └── agents/page.tsx               ← Agent roster + invite + availability toggle
│   │   ├── agent/
│   │   │   ├── layout.tsx                    ← Agent portal header + sign out
│   │   │   ├── page.tsx                      ← Agent dashboard: assigned escalations only
│   │   │   └── accept-invite/page.tsx        ← Password setup on invite link
│   │   └── api/
│   │       └── admin/
│   │           ├── invite-agent/route.ts     ← Server route: Supabase inviteUserByEmail
│   │           └── resend-invite/route.ts    ← Server route: resend invite email
│   ├── components/
│   │   ├── RelayPayLogo.tsx                  ← PNG logo via Next.js Image
│   │   ├── VapiErrorBoundary.tsx             ← React error boundary for voice controls
│   │   └── chat/
│   │       ├── VoiceButton.tsx               ← Mic button (5 states)
│   │       ├── TranscriptDisplay.tsx         ← Live subtitles during voice
│   │       ├── MessageThread.tsx             ← Chat message rows
│   │       ├── TextInput.tsx                 ← Auto-resize textarea
│   │       └── EscalationModal.tsx           ← Booking form + result states
│   └── lib/
│       ├── supabase.ts                       ← createBrowserClient (cookies, for SSR auth)
│       ├── database.types.ts                 ← TypeScript types for all 7 tables
│       └── utils.ts                          ← cn(), generateSessionId(), formatTime(),
│                                                formatDate(), validateEmail()
├── public/
│   └── logo.png                              ← RelayPay brand logo
└── .env.example                              ← Copy to .env.local, fill in values
```

---

## Supabase Schema

**Project ref:** `dmgxkdzoakruulqtfskc`

| Table | Key columns | Notes |
|-------|-------------|-------|
| `conversations` | `session_id`, `channel` (voice/text), `status` (active/closed/escalated), `vapi_call_id` | Real-time enabled |
| `messages` | `conversation_id`, `role` (user/assistant/system), `content`, `action_taken` | Real-time enabled; `messages_role_check` constraint — only user/assistant/system allowed |
| `knowledge_base` | `title`, `content`, `category`, `source_type`, `file_hash`, `embedding_status`, `chunk_count` | Real-time enabled |
| `knowledge_embeddings` | `knowledge_base_id`, `embedding vector(1536)`, `chunk_text`, `chunk_index`, `fts tsvector` | pgvector cosine similarity |
| `escalations` | `user_name`, `user_email`, `category`, `reason`, `call_booked`, `appointment_time`, `status` (open/in_progress/closed), `assigned_agent_id` | Real-time enabled |
| `agents` | `name`, `email`, `role`, `is_available`, `invite_status` (pending/accepted), `user_id` (references auth.users), `last_assigned_at` | RLS: authenticated can SELECT all; UPDATE only own row by email |
| `intent_log` | `conversation_id`, `message_id`, `intent`, `action_taken` | Analytics |

**Key function:** `hybrid_search_knowledge(query_embedding, query_text, match_threshold, match_count)` — Reciprocal Rank Fusion of vector + FTS results

---

## n8n Workflows

**Base URL:** `https://cohort2pod2.app.n8n.cloud/webhook/`

| Workflow | Path | Purpose | Status |
|----------|------|---------|--------|
| Text chat handler | `/relaypay-text` | Text messages → embed → RAG → GPT-4o → respond | ✅ Built |
| KB search (VAPI tool) | `/relaypay-kb-search` | Called by VAPI for factual KB lookups | ✅ Built |
| Appointment booking | `/relaypay-book-appointment` | EscalationModal submit → Google Calendar → email | ✅ Built |
| Voice events | `/relaypay-voice-events` | VAPI transcript → Supabase messages | ✅ Built (needs role filter fix) |
| Show escalation form | `/relaypay-show-escalation-form` | VAPI calls this → writes escalated message → responds | ✅ Built (needs response mode fix) |
| KB embed sync | `/relaypay-kb-sync` | Admin adds KB article → triggers embedding | ✅ Built |

---

## Environment Variables

### `frontend/.env.local`
```bash
NEXT_PUBLIC_SUPABASE_URL=https://dmgxkdzoakruulqtfskc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
NEXT_PUBLIC_VAPI_WEB_TOKEN=<public key from dashboard.vapi.ai>
NEXT_PUBLIC_VAPI_ASSISTANT_ID=<assistant ID from dashboard.vapi.ai>
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://cohort2pod2.app.n8n.cloud/webhook
NEXT_PUBLIC_SITE_URL=https://relaypay-voice-support.vercel.app
SUPABASE_SERVICE_ROLE_KEY=<service role key — server-side only>
```

### `frontend/next.config.ts`
Contains any image domain config for Next.js Image component.

---

## Brand Design System

```css
--color-primary:      #1B3A7A;   /* Deep Blue */
--color-accent:       #29ABE2;   /* Teal */
--color-bg:           #F7F8FA;   /* Off-white */
--color-surface:      #FFFFFF;
--color-border:       #E5E7EB;
--color-text:         #111827;
--color-text-muted:   #6B7280;
--color-destructive:  #DC2626;
```

Font: **Inter** (400/500/600 only). No gradients, no emojis in UI.

---

## MCP Servers (for Claude Code agent)

Configured in `~/.claude/settings.json` on the developer's Windows machine:

| Key | Binary | Tools prefix |
|-----|--------|-------------|
| `n8n-mcp` | `C:\Users\CIPM\AppData\Roaming\npm\n8n-mcp.cmd` | `mcp__n8n-mcp__*` |
| `github` | `C:\Users\CIPM\AppData\Roaming\npm\mcp-server-github.cmd` | `mcp__github__*` |
| `supabase` | `C:\Users\CIPM\AppData\Roaming\npm\mcp-server-supabase.cmd` | `mcp__supabase__*` |

Supabase MCP uses a Personal Access Token (`SUPABASE_ACCESS_TOKEN`) — not the service role key. Get a new one at https://supabase.com/dashboard/account/tokens if it expires.

---

## Immediate Next Actions (priority order)

1. **Fix `relaypay-show-escalation-form` in n8n** (see section above) — unblocks voice escalation flow
2. **Fix `relaypay-voice-events` role filter in n8n** — stops system prompt appearing as chat message and DB constraint errors
3. **Configure Gmail OAuth2 in n8n** — enables email notifications on booking
4. **Seed knowledge base** — add RelayPay FAQ articles via `/admin/knowledge-base`
5. **Resend invite** for any agent whose `user_id` is still NULL — admin clicks Resend Invite on their card, agent re-accepts

---

## Verification Checklist

- [ ] Voice call starts → mic button animates → VAPI speaks greeting
- [ ] "What are your fees?" → agent searches KB → answers from KB content
- [ ] "My account is suspended" → VAPI calls `show_escalation_form` → EscalationModal appears overlaid on active call → user fills in name/email/time → submits → call booking fires → VAPI speaks confirmation
- [ ] After a voice call: Supabase messages table has only `role: user` and `role: assistant` rows (no system prompt, no tool_calls)
- [ ] Text chat → same response pipeline → escalation modal when escalated
- [ ] Admin: add KB article → embedding status shows "complete" → appears in RAG results
- [ ] Admin: escalation queue updates in real-time when a booking is submitted
- [ ] Admin: invite new agent → agent receives email → sets password → appears at `/agent` with their assigned escalations
- [ ] Forgot password flow: email sent → link works → new password set → login with success banner
- [ ] All pages work on mobile (320px+), tablet, desktop
