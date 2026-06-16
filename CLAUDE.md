# CLAUDE.md

Guidance for Claude Code when working in the Lety Widget repository.

## Overview

Independent repo for the **public, client-facing** embeddable chat widget. Separate
from `Lety-2.0_Backend` and `Lety-2.0_Frontend`. Everything here ships to third-party
websites, so bundle size, isolation from the host page, and security matter.

## Packages

- `packages/loader` — `widget.js`. Lightweight (target a few KB). Reads `data-widget-id`,
  injects the floating bubble + chat iframe without touching the host page's CSS/JS.
  Logs a clear console message when blocked (wrong domain / disabled widget / inactive agent).
- `packages/app` — standalone iframe chat app (NOT the Next.js dashboard). Fetches public
  config, renders branding/colors/texts/position, handles auto-open and the single fixed
  notification sound, talks to the `widget-chat` WebSocket namespace. Visitor identity in
  `localStorage` of the iframe origin.
- `packages/react` — `@lety-ai/react`, `<LetyWidget widgetId="w_xxx" />`. Uses the loader
  under the hood; single instance even if mounted twice; clean unmount.

## Conventions

- Language: all code, comments, logs in English.
- Conventional commits (`type(scope): subject`).
- No inline comments unless requested.
- TypeScript strict mode.
- The loader must not leak internal IDs — only the public `widgetId` is ever used client-side.

## Backend contract

Public endpoints (in `Lety-2.0_Backend` api-gateway, `@Public()`):
- `GET /public/widgets/:widgetId/config`
- `POST /public/widgets/:widgetId/session` → short-lived visitor token
- WebSocket namespace `widget-chat` (visitor-token guarded)
