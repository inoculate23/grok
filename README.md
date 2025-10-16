**Grok Agentic AI Translator and Travel Assistant**

**Features**

*Multi-Modal Translation - Translate text, audio, video, and camera/document captures in real-time
*Text Translation - Type or paste text and instantly translate to any language with natural voice output
*Audio Translation - Speak naturally and get live transcription and translation with voice responses
*Video Translation - Upload videos and generate multilingual captions with translated audio tracks
*Camera/Document Translation - Point your camera at real-world text for instant OCR and translation
*Translation History - All translations saved with timestamps and searchable history
*Tour Guide - Discover nearby places, view routes, and get AI-powered travel recommendations
*AI-Powered Chat - Ask anything and get intelligent responses with agentic AI capabilities
*LLM Integration - Powered by advanced language models for accurate, context-aware translations
*MCP Server - Model Context Protocol server for extensible AI tool integration
*W3 Storage - Decentralized storage for media files and translation data
*Stripe Payments - Secure checkout for premium features and subscriptions

** 
Environment Setup
- Copy `.env.example` to `.env` and fill values:
  - `VITE_SUPABASE_URL` – your Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` – your Supabase anon key
  - `VITE_ENABLE_TRANSLATION_HISTORY` – set to `false` by default

Translation History Toggle
- `VITE_ENABLE_TRANSLATION_HISTORY=false` disables Supabase writes/reads for `translations`, avoiding 403 errors while RLS is strict.
- Set `VITE_ENABLE_TRANSLATION_HISTORY=true` to enable saving and viewing history once your policies are configured.

Supabase RLS Options for `translations`
- Option A: Public history (simple)
  - Policies: allow `INSERT` and `SELECT` for `anon` and `authenticated` with `WITH CHECK (true)` and `USING (true)`.
- Option B: Per-user history (recommended)
  - Add `user_id uuid references auth.users(id)` to `translations`.
  - Policies:
    - `INSERT`: `WITH CHECK (user_id = auth.uid())`
    - `SELECT`: `USING (user_id = auth.uid())`
    - Optional `DELETE`: `USING (user_id = auth.uid())`

Notes
- The app short-circuits history calls when the flag is not `true`.
- Enable the flag only after verifying your Supabase policies to prevent 403 errors.

Stripe Production Setup
- Set frontend env to production:
  - `VITE_SUPABASE_URL` – your production project URL
  - `VITE_SUPABASE_ANON_KEY` – your production anon key
- Configure Supabase Edge Function secrets in the production project:
  - `STRIPE_SECRET_KEY` – `sk_live_...`
  - `STRIPE_WEBHOOK_SECRET` – from Stripe webhook endpoint
  - `SUPABASE_URL` – `https://<prod-ref>.supabase.co`
  - `SUPABASE_ANON_KEY` – production anon key
  - `SUPABASE_SERVICE_ROLE_KEY` – service role for webhook inserts
- Example command:
  - `supabase secrets set --project-ref <prod-ref> STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... SUPABASE_URL=https://<prod-ref>.supabase.co SUPABASE_ANON_KEY=<anon> SUPABASE_SERVICE_ROLE_KEY=<service-role>`
- Deploy functions to production:
  - `supabase functions deploy create-checkout-session --project-ref <prod-ref>`
  - `supabase functions deploy stripe-webhook --project-ref <prod-ref>`
- Stripe webhook:
  - URL: `https://<prod-ref>.functions.supabase.co/stripe-webhook`
  - Events: `checkout.session.completed`
  - Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

Optional: Fetch keys via MCP
- Start the MCP Storage Server in REST mode: `pnpm --filter mcp-storage-server start:rest`
- Retrieve a stored secrets file (example):
  - `curl -s http://localhost:3001/rest -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"retrieve","arguments":{"rootCid":"<cid>","path":"stripe.json"}}}' > mcp-response.json`
  - Decode the base64 payload to `stripe.json` (the server returns data URIs): parse the JSON to extract content, strip the `data:*;base64,` prefix, and `base64 --decode`.
- Export and set Supabase secrets from `stripe.json` fields:
  - `export STRIPE_SECRET_KEY=$(jq -r '.secret_key' stripe.json)`
  - `export STRIPE_WEBHOOK_SECRET=$(jq -r '.webhook_secret' stripe.json)`
  - `supabase secrets set --project-ref <prod-ref> STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET"`

Security Note
- Do not commit production keys to source control.
- Prefer Supabase secrets for deployment; use MCP retrieval only from a secured source.
