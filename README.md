<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8239a164-09ee-4689-8b40-97ab0933e4de

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Módulo Bar / Comandas

O módulo Bar / Comandas está disponível no painel administrativo em **Bar / Comandas** (`/admin/bar-comandas`). Ele inclui telas separadas para PDV/Nova comanda, Comandas e Produtos; busca de produtos por nome/categoria; lista de itens organizada; e ações de editar, ativar/desativar e excluir produtos com ícones.

Antes de usar o módulo em um projeto Supabase existente, execute no SQL Editor o arquivo `src/db/migrations/20261019_bar_comandas.sql`. Faça backup do banco antes de aplicar migrations em produção.
