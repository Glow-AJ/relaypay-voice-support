# RelayPay Voice Customer Support Agent — Full Project Context

> **Read this entire file before doing any work.** It contains everything needed to build, continue, or debug this project without any prior context.

---

## What This Project Is

A **production-ready voice + text AI customer support agent** for RelayPay, a B2B fintech company providing cross-border payments for African SMEs.

**Two surfaces:**
- **Public interface** (`/`) — customers speak or type; AI responds in real-time with voice + live subtitles
- **Admin interface** (`/admin`) — support team manages knowledge base, escalations, conversations, agents

**Core AI flow:** Customer speaks/types → n8n receives → OpenAI embeds query → pgvector RAG search → GPT-4o generates grounded response → escalate to human if needed

---

## Tech Stack

| Layer | Technology | Details |
|-------|------------|---------|
| Voice | VAPI | Web SDK for browser voice calls; STT + TTS; connects to n8n via Server URL |
| Orchestration | n8n | Cloud: https://cohort2pod2.app.n8n.cloud — 5 workflows |
| Database | Supabase | Project ref: `dmgxkdzoakruulqtfskc` — pgvector, RLS, real-time |
| AI | OpenAI ONLY | `gpt-4o` (response/intent) + `text-embedding-ada-002` (RAG embeddings, 1536-dim) |
| Frontend | Next.js 14 | App Router, TypeScript, Tailwind CSS v4, shadcn/ui |
| Repo | GitHub | `Glow-AJ/relaypay-voice-support` |

---

## MCP Servers (in `~/.claude/settings.json`)

All use direct global `.cmd` binary paths (Windows fix — npx doesn't work without shell):

| Key | Binary | Tools prefix | Purpose |
|-----|--------|-------------|---------|
| `n8n-mcp` | `C:\Users\CIPM\AppData\Roaming\npm\n8n-mcp.cmd` | `mcp__n8n-mcp__*` | n8n workflow CRUD |
| `github` | `C:\Users\CIPM\AppData\Roaming\npm\mcp-server-github.cmd` | `mcp__github__*` | GitHub API |
| `supabase` | `C:\Users\CIPM\AppData\Roaming\npm\mcp-server-supabase.cmd` | `mcp__supabase__*` | Supabase DB/SQL |

**Supabase MCP** uses a Personal Access Token (PAT) — not the service role key.
PAT is set as `SUPABASE_ACCESS_TOKEN` in `~/.claude/settings.json`.
Get new PAT at: https://supabase.com/dashboard/account/tokens

---

## Credentials (`.env` — never commit)

```bash
# n8n
N8N_API_URL=https://cohort2pod2.app.n8n.cloud
N8N_API_KEY=...

# Supabase
SUPABASE_URL=https://dmgxkdzoakruulqtfskc.supabase.co
SUPABASE_PROJECT_REF=dmgxkdzoakruulqtfskc
SUPABASE_SERVICE_ROLE_KEY=...    # full DB access — server/n8n only, never browser
SUPABASE_ANON_KEY=...            # safe for browser

# GitHub
GITHUB_PERSONAL_ACCESS_TOKEN=...

# OpenAI (ONLY AI provider)
OPENAI_API_KEY=...               # gpt-4o + text-embedding-ada-002

# VAPI
VAPI_API_KEY=...                 # Private key — for n8n to call VAPI API
```

**Frontend** also needs `frontend/.env.local` (see `frontend/.env.example`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://dmgxkdzoakruulqtfskc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_VAPI_WEB_TOKEN=...     # Public key from VAPI dashboard
NEXT_PUBLIC_VAPI_ASSISTANT_ID=...  # Created after VAPI assistant setup
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://cohort2pod2.app.n8n.cloud/webhook
```

---

## System Architecture

```
CUSTOMER (browser)
  │
  ├─ Voice → VAPI Web SDK (@vapi-ai/web)
  │               │
  │         VAPI Cloud (STT → text, TTS → speech)
  │               │ Server URL webhook
  │               ↓
  └─ Text ──→ n8n Webhook (unified entry point)
                  │
     ┌────────────▼───────────────────┐
     │        n8n Workflows           │
     │                                │
     │ 1. Main AI Handler             │ ← OpenAI embed → pgvector RAG → GPT-4o
     │ 2. Escalation Handler          │ ← Supabase insert → email alert
     │ 3. Appointment Booking         │ ← Google Calendar → email confirmation
     │ 4. KB Embedding Sync           │ ← OpenAI embed → Supabase upsert
     │ 5. Health Monitor (scheduled)  │
     └──────────────┬─────────────────┘
                    │
          ┌─────────▼──────────┐
          │      SUPABASE       │
          │  conversations      │ ← real-time subscription in frontend
          │  messages           │ ← real-time subscription in frontend
          │  knowledge_base     │
          │  knowledge_embeddings│ ← pgvector 1536-dim cosine similarity
          │  escalations        │ ← real-time subscription in frontend
          │  agents             │
          │  intent_log         │
          └─────────────────────┘
                    ↑
          Admin frontend writes directly via Supabase JS client
          (RLS enforced; service role bypasses RLS in n8n)
```

---

## Frontend Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Public: VAPI voice + text chat interface
│   │   ├── layout.tsx            ← Inter font, Sonner toaster, metadata
│   │   ├── globals.css           ← RelayPay CSS vars, pulse/speaking animations
│   │   └── admin/
│   │       ├── layout.tsx        ← Sidebar: Dashboard/KB/Escalations/Convos/Agents
│   │       ├── page.tsx          ← Dashboard: 4 stat cards + recent escalations
│   │       ├── login/page.tsx    ← Supabase auth (email + password)
│   │       ├── knowledge-base/   ← CRUD table + search/filter + embedding trigger
│   │       ├── escalations/      ← Split panel: list + detail + status update
│   │       ├── conversations/    ← Conversation list + message thread viewer
│   │       └── agents/           ← Agent cards + availability toggle + add/delete
│   ├── components/
│   │   ├── RelayPayLogo.tsx      ← SVG inline: teal/green icon + deep blue wordmark
│   │   ├── chat/
│   │   │   ├── VoiceButton.tsx   ← Mic button: idle/connecting/listening/speaking/error
│   │   │   ├── TranscriptDisplay.tsx ← Live partial + final user transcript + agent subtitle
│   │   │   ├── MessageThread.tsx ← Clean message rows (not heavy bubbles) + typing indicator
│   │   │   ├── TextInput.tsx     ← Auto-resize textarea, Enter to send, Shift+Enter newline
│   │   │   └── EscalationModal.tsx ← Name/email/date/time/timezone form + success state
│   │   └── ui/                   ← shadcn components: button, badge, input, textarea,
│   │                                dialog, select, table, sonner
│   └── lib/
│       ├── supabase.ts           ← createClient<Database> with real-time config
│       ├── database.types.ts     ← Full TypeScript types for all 7 tables + match_knowledge fn
│       └── utils.ts              ← cn(), generateSessionId(), formatTime(), formatDate()
└── .env.example                  ← Template — copy to .env.local
```

---

## Brand Design System

```css
--color-primary:      #1B3A7A;   /* Deep Blue — buttons, headings, sidebar active */
--color-primary-hover:#162F63;   /* Hover state */
--color-accent:       #29ABE2;   /* Teal — active states, links, connecting state */
--color-accent-green: #3DBB61;   /* Green — logo icon ONLY, not UI */
--color-bg:           #F7F8FA;   /* Off-white background */
--color-surface:      #FFFFFF;   /* Cards, panels */
--color-border:       #E5E7EB;   /* Dividers, input borders */
--color-text:         #111827;   /* Primary text */
--color-text-muted:   #6B7280;   /* Secondary text */
--color-destructive:  #DC2626;   /* Errors only */
```

**Rules:** Inter font (400/500/600), no gradients, no emojis in UI, no heavy chat bubbles, minimal + professional + high-trust.

---

## Supabase Schema

**Migration file:** `supabase/migrations/001_initial_schema.sql`

**Tables:**
| Table | Key columns |
|-------|-------------|
| `conversations` | session_id, channel (voice/text), status (active/closed/escalated), vapi_call_id |
| `messages` | conversation_id, role (user/assistant/system), content, audio_url, action_taken |
| `knowledge_base` | title, content, category (fees/onboarding/payouts/invoicing/compliance/general/troubleshooting), is_active |
| `knowledge_embeddings` | knowledge_base_id, embedding vector(1536) |
| `agents` | name, email, role (support/admin/supervisor), is_available |
| `escalations` | user_name, user_email, category, reason, call_booked, appointment_time, status (open/in_progress/closed) |
| `intent_log` | conversation_id, message_id, intent, confidence, rag_results_count |

**Key function:** `match_knowledge(embedding, threshold=0.75, count=5)` — pgvector cosine similarity via `<=>` operator

**Status:** Migration SQL is written. Apply via `mcp__supabase__apply_migration` or paste into Supabase SQL Editor.

---

## n8n Workflows (5 to build)

### n8n Rules
- Always use `mcp__n8n-mcp__*` tools — never hand-write JSON
- Use `mcp__n8n-mcp__search_nodes` to find node types before building
- Expression syntax: `{{ $json.field }}` (not old `$node["name"].json`)
- Supabase calls: HTTP Request node with `apikey` + `Authorization: Bearer` headers

### Webhook URL base
`https://cohort2pod2.app.n8n.cloud/webhook/`

### Workflow 1: Main AI Handler
**Path:** `/relaypay-text` (text) + VAPI Server URL for voice
**Flow:**
```
[Webhook]
  → [Set: extract message, session_id, channel]
  → [HTTP POST: OpenAI embeddings API — text-embedding-ada-002]
  → [HTTP POST: Supabase RPC match_knowledge(embedding)]
  → [Upsert conversation in Supabase]
  → [Insert user message in Supabase]
  → [OpenAI GPT-4o: classify intent + generate response with RAG context]
  → [Switch: action_taken]
      answered/clarified → Insert assistant message → Respond
      escalated          → Trigger Workflow 2 → Respond
      declined           → Insert assistant message → Respond
```

**GPT-4o system prompt context:**
- RelayPay support persona
- RAG docs injected as `[CONTEXT]`
- Must decide: answered / clarified / escalated / declined
- Never guess on compliance/account/dispute topics — always escalate

### Workflow 2: Escalation Handler
**Path:** `/relaypay-escalate`
```
[Webhook/Subworkflow]
  → [Insert escalation record to Supabase]
  → [Update conversation status = 'escalated']
  → [Send Email: notify support team]
  → [Update notification_sent = true]
  → [Respond: confirm escalation + prompt for scheduling]
```

### Workflow 3: Appointment Booking
**Path:** `/relaypay-book-appointment`
```
[Webhook: name + email + preferredDate + preferredTime + timezone]
  → [Google Calendar: check availability]
  → [If available]
      YES → [Google Calendar: create event]
           → [Update escalation: call_booked=true, appointment_time]
           → [Send Email: confirmation + invite to customer]
           → [Respond: "Your call is booked for {time}"]
      NO  → [Respond: suggest 3 alternative slots]
```

### Workflow 4: KB Embedding Sync
**Path:** `/relaypay-kb-sync`
```
[Webhook: {action: 'create'|'update', title: string}]
  → [Fetch KB entry from Supabase by title]
  → [OpenAI: generate embedding for content]
  → [Upsert to knowledge_embeddings table]
  → [Respond: success]
```

### Workflow 5: Health Monitor
**Trigger:** Cron every 15 minutes
```
[Schedule]
  → [HTTP: ping Supabase REST API]
  → [If any failure] → [Send Email alert to admin]
```

---

## VAPI Configuration

**Get keys from:** https://dashboard.vapi.ai
- **Private API Key** → `VAPI_API_KEY` in `.env` (for n8n to call VAPI management API)
- **Web Token** → `NEXT_PUBLIC_VAPI_WEB_TOKEN` in `frontend/.env.local` (for browser SDK)

**Assistant setup:**
- Server URL: `https://cohort2pod2.app.n8n.cloud/webhook/relaypay-voice`
- Voice: ElevenLabs or VAPI built-in — professional, calm, warm
- System prompt: RelayPay support persona (answer from KB, escalate sensitive issues)
- After creating assistant, copy the Assistant ID → `NEXT_PUBLIC_VAPI_ASSISTANT_ID`

---

## n8n Supabase Integration Pattern

```javascript
// HTTP Request node config for Supabase
URL: https://dmgxkdzoakruulqtfskc.supabase.co/rest/v1/{table}
Headers:
  apikey: {SUPABASE_ANON_KEY}
  Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
  Content-Type: application/json
  Prefer: return=representation   // for INSERT to get the created row back
```

---

## Knowledge Base Seeding

Initial KB articles to add (insert into `knowledge_base` table, then call `/relaypay-kb-sync`):

**Categories to cover:**
- `fees` — transaction fees, exchange rates, pricing
- `onboarding` — account setup, KYC, verification
- `payouts` — payout schedules, processing times, limits
- `invoicing` — invoice creation, status, disputes
- `compliance` — AML, KYB, regulatory requirements (always escalate)
- `general` — contact info, supported countries, currencies
- `troubleshooting` — common errors, failed payments, account issues

---

## Build Status & Next Steps

### Completed
- [x] GitHub repo created: `Glow-AJ/relaypay-voice-support`
- [x] Next.js 14 frontend scaffolded with TypeScript + Tailwind v4
- [x] Public interface: voice button (VAPI), text input, real-time messages, transcript display, escalation modal
- [x] Admin portal: login, dashboard, knowledge base CRUD, escalations queue, conversations browser, agents management
- [x] Full TypeScript DB types (`database.types.ts`) — all 7 tables + `match_knowledge` RPC
- [x] Supabase migration SQL written (`supabase/migrations/001_initial_schema.sql`)
- [x] RelayPay brand design system implemented throughout
- [x] All code pushed to GitHub (clean, no secrets committed)

### Next Steps (in order)

**Step 1: Apply Supabase Migration**
```
Tool: mcp__supabase__apply_migration
Name: initial_schema
Query: (contents of supabase/migrations/001_initial_schema.sql)
```

**Step 2: Build n8n Workflow 1 (Main AI Handler)**
- Use `mcp__n8n-mcp__search_nodes` to find: Webhook, HTTP Request, OpenAI, Switch, Code nodes
- Build the flow described above
- Test with `curl -X POST {webhook_url} -d '{"message":"What are your fees?","session_id":"test"}'`

**Step 3: Build n8n Workflow 2 (Escalation Handler)**
- Triggered by Workflow 1 when action_taken = 'escalated'
- Needs: email SMTP credentials configured in n8n

**Step 4: Build n8n Workflow 3 (Appointment Booking)**
- Needs Google Calendar OAuth2 credential in n8n
- Use native n8n Google Calendar node

**Step 5: Build n8n Workflow 4 (KB Embedding Sync)**
- Simple: fetch KB content → embed → upsert

**Step 6: Configure VAPI Assistant**
- Create assistant at vapi.ai
- Set Server URL = n8n Workflow 1 webhook URL
- Copy assistant ID to `frontend/.env.local`

**Step 7: Seed Knowledge Base**
- Add RelayPay FAQ articles via admin UI or direct Supabase insert
- Trigger embedding sync for each article

**Step 8: Set Frontend Env Vars**
- Fill in `frontend/.env.local` with real Supabase anon key + VAPI tokens + n8n URL
- Test full voice call → response flow

**Step 9: End-to-End Test**
- Voice call → transcript → RAG → response → spoken back
- Text message → same pipeline
- Escalation flow → email → booking → calendar invite
- Admin can view everything in real-time

---

## Verification Test Checklist

- [ ] Voice call via VAPI web SDK → response spoken + shown as subtitle
- [ ] Text message → AI answers from knowledge base
- [ ] Vague question → clarification asked
- [ ] Compliance question → escalation triggered, record in Supabase
- [ ] Escalation booking form → Google Calendar event created
- [ ] Admin: add KB article → embedding generated → used in responses
- [ ] Admin: escalation queue updates in real-time
- [ ] Admin: conversation history shows full thread

---

## File Reference Quick Guide

| File | What it does |
|------|-------------|
| `frontend/src/app/page.tsx` | Public chat: VAPI init, real-time sub, text handler, voice toggle |
| `frontend/src/app/admin/page.tsx` | Dashboard stats + recent escalations table |
| `frontend/src/app/admin/login/page.tsx` | Supabase email/password auth |
| `frontend/src/app/admin/knowledge-base/page.tsx` | KB CRUD + embedding trigger |
| `frontend/src/app/admin/escalations/page.tsx` | Queue + detail panel + status update |
| `frontend/src/app/admin/conversations/page.tsx` | Conversation list + message viewer |
| `frontend/src/app/admin/agents/page.tsx` | Agent roster + availability |
| `frontend/src/components/chat/VoiceButton.tsx` | Mic button with 5 states |
| `frontend/src/components/chat/EscalationModal.tsx` | Scheduling form → n8n booking webhook |
| `frontend/src/lib/database.types.ts` | All Supabase TypeScript types |
| `supabase/migrations/001_initial_schema.sql` | Full DB schema — apply this first |
