# Project Reflection Questions

## 1. Clarifying Questions Expected in a Business Setting
Before initiating an AI voice workflow of this magnitude, I would ask the stakeholders the following to ensure precise technical alignment:
* **Multi-Modal Redundancy:** Would the PM want the project to include an integrated text path? Voice-only tools are extremely disruptive for users residing in public, noisy, or confidential workspace environments.
* **Knowledge Data Sources:** Based on the current approved knowledge bases (which only ingest raw URLs), will the system ever be required to ingest raw file formats (e.g., `.docx`, `.pdf`, `.csv`)? We need to know this to architect the vector chunking pipeline appropriately.
* **Timeout Bounds:** What is the specific latency tolerance before we manually transition a customer away from an AI "thinking" state straight to the human escalation form?

## 2. Most Significant Challenge & Its Root Cause
* **Challenge:** Stabilizing the Vapi SDK connection to the frontend while simultaneously perfecting the AI persona's prompt constraints. We frequently encountered "Voice unavailable" errors and rigid conversational dead-ends.
* **Root Cause:** Audio input lifecycle management in modern web browsers is notoriously strict (microphone permission lifecycles, iOS audio contexts). Furthermore, building out the prompt for the Vapi Agent required walking a tightrope: we needed it strict enough to not hallucinate financial advice, yet fluid enough to seamlessly invoke the JSON `tool-call` for escalation exactly when the user's intent shifted, without the AI becoming overly defensive.

## 3. What I Would Do Differently
If I were to rebuild this project with my current knowledge, my primary difference would be:
* **Hybrid Interface Architecture:** I would immediately add an integrated text path/chat UI for the web app natively alongside the voice module. Not only does this solve the "public environment" accessibility issue, but it naturally provides a visual logging anchor for users to scroll up and review what the AI transcribed and interpreted during their interaction.

## 4. Edge Cases Accounted For

**Data Integrity & Formatting Errors**
* **Strict Input Validation:** Utilized native HTML5 boundary constraints (`type="email"`, `required=true`) across the Escalation Modal and Admin portals, ensuring malformed email strings are rejected immediately before emitting expensive backend network requests.
* **Deduplicated Ingestion Flow:** In our knowledge base ingestion flow, we actively generate and verify cryptographic hashes of document contents. If a hash already exists, the duplication is blocked.
* **Stale Vector Re-Ingestion:** When a user updates the content living at a specific URL, the resulting hash evaluates as different. The system automatically accounts for this by explicitly deleting the stale vector embeddings and old DB records before ingesting the fresh array.

**Agent Workflows & Error Boundaries**
* **Form Abandonment States:** If the AI triggers an escalation but the user forcibly closes the modal without submitting their details, the system avoids deadlocking. Instead, we pass an explicit *"Customer closed the escalation form without submitting"* system message back to the Vapi processor, prompting the AI to gracefully acknowledge the cancellation and recommend a support email route.
* **Microphone Denial & Connection Errors:** Unforeseen Vapi drops or microphone permission denials are bounded cleanly. Hard failures fall back to `VapiErrorBoundary` mechanisms and native UI `toast.error()` alerts, replacing infinite spin-states with distinct human-readable alerts.
* **Middleware Auth Deadlocks:** The Next.js middleware is engineered to strictly protect the `/admin` portal while deliberately allowing `/agent/accept-invite` to bypass the session check. Without this exemption edge-case handled, invited agents would continually be denied access before they could even accept their invite.
* **Graceful API Failures:** Wrapped our asynchronous endpoints (like Supabase DB inserts and n8n webhook pushes) in robust `.catch()` and `Response.ok` checks, ensuring that silent network failures yield explicit visible alerts (e.g. `toast.error('Could not create KB entry. Check Supabase connection.')`).
