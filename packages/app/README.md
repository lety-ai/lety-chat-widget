# @lety-ai/widget-app

Standalone chat app rendered inside the widget iframe (NOT the Next.js dashboard).

Responsibilities (LET-2037):

- Fetch the public config (`GET /public/widgets/:widgetId/config`) and render branding,
  colors, texts and position.
- Auto-open on load when enabled; play the single fixed notification sound on new agent
  messages when enabled.
- Establish a visitor session (`POST /public/widgets/:widgetId/session`) and connect to the
  `widget-chat` WebSocket namespace.
- Persist visitor identity in `localStorage` of the iframe origin so the conversation
  survives page reloads.
- Work both as a floating bubble (via the loader) and as a direct inline iframe embed.
