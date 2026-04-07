# Voice Based Customer Support Agent — Project Context

This file provides complete context for any Claude agent working on this project. Read it fully before starting any work.

---

## Project Overview

**Goal:** Build a voice-based customer support AI agent that handles inbound customer queries via voice, routes issues intelligently, resolves common questions automatically, and escalates to human agents when needed.

**Stack:**
- **Automation & Orchestration:** n8n (cloud: https://cohort2pod2.app.n8n.cloud)
- **Database:** Supabase (project ref: `dmgxkdzoakruulqtfskc`, url: https://dmgxkdzoakruulqtfskc.supabase.co)
- **Version Control:** GitHub (user: Glow-AJ, PAT configured)
- **AI:** Claude (claude-sonnet-4-6 / claude-opus-4-6 via Anthropic API)
- **Design:** UI/UX Pro Max + Frontend Design skills

---

## MCP Servers (Configured in ~/.claude/settings.json)

> All 3 servers start automatically when Claude Code starts. If tools are missing, restart Claude Code.

| Server key | Package | Tools prefix | Purpose |
|------------|---------|-------------|---------|
| `n8n-mcp` | `npx n8n-mcp@latest` | `mcp__n8n-mcp__*` | Create/manage/activate n8n workflows |
| `github` | `npx @modelcontextprotocol/server-github@latest` | `mcp__github__*` | Repos, PRs, issues, commits |
| `supabase` | `npx @supabase/mcp-server-supabase@latest` | `mcp__supabase__*` | DB tables, SQL, migrations, Edge Functions |

### Supabase MCP — Important Note
`@supabase/mcp-server-supabase` requires a **Supabase Personal Access Token** (PAT), which is different from the service role key. Get it from:
**https://supabase.com/dashboard/account/tokens**

The service role key in `.env` is for REST API calls. If the Supabase MCP tools fail auth, generate a PAT and update `SUPABASE_ACCESS_TOKEN` in `~/.claude/settings.json`.

**Fallback for DB operations** (always works with service role key):
```bash
curl -s "https://dmgxkdzoakruulqtfskc.supabase.co/rest/v1/{table}" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

---

## Skills (Installed in ~/.claude/plugins/marketplaces/)

> Skills load automatically. Invoke them with `/skill-name` or they activate contextually.

| Skill | Marketplace | What it provides |
|-------|------------|-----------------|
| `n8n-mcp-skills` | czlonkowski/n8n-skills | 7 sub-skills: n8n expressions, MCP tools usage, workflow patterns, validation, node config, JS code, Python code |
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill | 67 UI styles, 96 palettes, 57 font pairings, 25 chart types, 13 stack guidelines, UX rules |
| `frontend-design` | anthropics/claude-code (plugins/frontend-design) | Production-grade UI: characterful typography, aesthetic consistency, visual depth |

---

## Credentials (all in .env — never hard-code)

```
N8N_API_URL=https://cohort2pod2.app.n8n.cloud
N8N_API_KEY=...
SUPABASE_URL=https://dmgxkdzoakruulqtfskc.supabase.co
SUPABASE_PROJECT_REF=dmgxkdzoakruulqtfskc
SUPABASE_SERVICE_ROLE_KEY=...   ← full DB access via REST API
SUPABASE_ANON_KEY=...           ← client-side safe
GITHUB_PERSONAL_ACCESS_TOKEN=...
```

---

## n8n Workflow Rules (from n8n-mcp-skills)

Always use the n8n-mcp MCP tools — never hand-craft workflow JSON:

1. `mcp__n8n-mcp__get_node_types` — find the right node before building
2. `mcp__n8n-mcp__create_workflow` — create the workflow
3. `mcp__n8n-mcp__validate_workflow` — validate before activating
4. `mcp__n8n-mcp__update_workflow` + `mcp__n8n-mcp__activate_workflow` — deploy

**Expression syntax:** Always `{{ $json.field }}` — never old `$node["name"].json.field`.

**Supabase in n8n:** HTTP Request node →
- URL: `https://dmgxkdzoakruulqtfskc.supabase.co/rest/v1/{table}`
- Headers: `apikey: {SUPABASE_ANON_KEY}`, `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}`
- Method: GET / POST / PATCH / DELETE per operation

---

## Voice Agent Architecture (planned)

```
Voice Input
    ↓
n8n Webhook (receives transcript/audio)
    ↓
Claude AI Node (intent classification)
    ↓
Supabase Lookup (knowledge base / FAQs)
    ↓
Claude AI Node (response generation)
    ↓
Escalation Check → Low confidence → Human queue (Supabase)
    ↓
Response delivery + Supabase logging
```

---

## Supabase Schema (to be created)

| Table | Purpose |
|-------|---------|
| `conversations` | Call/chat sessions with metadata |
| `messages` | Individual messages per conversation |
| `intents` | Classified intent categories |
| `knowledge_base` | Support articles and FAQs |
| `escalations` | Flagged conversations needing human review |
| `agents` | Human agent roster and availability |

---

## Design Guidelines

For any frontend (dashboards, agent console, admin UI):
- Invoke `/ui-ux-pro-max` for full design system generation
- Invoke `/frontend-design` for distinctive component-level UI
- Tailwind CSS + shadcn/ui preferred
- Dark mode required from start
- Stack: Next.js or plain HTML/CSS/JS depending on scope

---

## Project File Structure

```
Voice Based Customer Support Agent/
├── CLAUDE.md          ← Read this first (you are here)
├── .env               ← All credentials (never commit)
├── .gitignore         ← Excludes .env and node_modules
└── workflows/         ← n8n workflow JSON exports
```

