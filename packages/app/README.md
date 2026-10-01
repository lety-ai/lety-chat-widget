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
- In inline mode inside an iframe, resolve the embedding page origin from
  `location.ancestorOrigins` (fallback `document.referrer`) and send it as the
  `x-lety-embed-origin` header on `/config` and `/session`. The gateway only honours
  that header when the request `Origin` is a configured widget app origin
  (`WIDGET_APP_ORIGINS`), and validates it against the widget allowed domains. If the
  host page suppresses the referrer, the embed is refused with a console warning.
