# ArenaPro WhatsApp booking integration

## Architecture

- Each arena admin connects one WhatsApp number from **Administração → WhatsApp** by scanning the QR code.
- ArenaPro creates one Evolution API instance per arena and receives connection and message events through the isolated n8n workflow at `automation/n8n/arenapro-whatsapp-workflow.json`.
- The workflow calls the protected ArenaPro API to check court availability and prepare a booking offer. A booking is only written after the customer replies with the offer confirmation code; the database rechecks conflicts before confirming.

## Deployment configuration

Configure these server-only Vercel environment variables:

- `EVOLUTION_API_URL` — Evolution API base URL.
- `EVOLUTION_API_KEY` — Evolution API server key.
- `ARENAPRO_N8N_WEBHOOK_URL` — n8n production webhook URL for `arenapro-whatsapp`.

The n8n workflow needs the existing OpenRouter credential and an active webhook after Vercel deploys the API routes. Keep the workflow inactive until these settings are present and a test conversation is ready. Do not place Evolution or webhook keys in browser environment variables. Use the `sensitive` type for `EVOLUTION_API_KEY`; keep test credentials scoped to the feature Preview branch until the WhatsApp flow is validated. Add the same key to Production only when the integration is ready to release.

The additive database migration is `supabase/migrations/20261026_arenapro_whatsapp.sql`.
