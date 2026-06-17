// Lety widget loader. Dependency-free, injected on customer sites via:
//   <script src="https://cdn.lety.ai/widget.js" data-widget-id="w_xxx" async></script>
//
// The loader runs on the HOST page, so its fetches to the public widget API
// carry the real site Origin — that is what enforces the allowed-domains rule.
// It resolves the config + a visitor session token, then boots the chat iframe
// (the app) inside a Shadow DOM and hands it the token via postMessage. When the
// widget is blocked (disabled, inactive agent, or non-allowed domain) it logs a
// clear console message and renders nothing.

declare const __LETY_WIDGET_APP_ORIGIN__: string;
declare const __LETY_API_BASE__: string;

interface DisplayConfig {
  assistantName: string;
  avatarUrl?: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  position: 'left' | 'right';
  autoOpen: boolean;
  soundEnabled: boolean;
}

interface SessionResponse {
  token: string;
  visitorId: string;
}

const APP_ORIGIN = __LETY_WIDGET_APP_ORIGIN__;
const API_BASE = __LETY_API_BASE__;
const PUBLIC_PATH = '/api/v1/public/widgets';

(function initLetyWidget() {
  const win = window as Window & { __letyWidgetLoaded?: boolean };
  if (win.__letyWidgetLoaded) return;

  const currentScript =
    (document.currentScript as HTMLScriptElement | null) ||
    document.querySelector<HTMLScriptElement>('script[data-widget-id]');
  const widgetId = currentScript?.getAttribute('data-widget-id')?.trim();

  if (!widgetId) {
    console.warn('Lety widget: missing data-widget-id attribute on the script tag.');
    return;
  }

  win.__letyWidgetLoaded = true;

  const visitorKey = `lety:visitor:${widgetId}`;

  const readVisitorId = (): string | undefined => {
    try {
      return localStorage.getItem(visitorKey) ?? undefined;
    } catch {
      return undefined;
    }
  };

  const storeVisitorId = (id: string) => {
    try {
      localStorage.setItem(visitorKey, id);
    } catch {
      /* storage may be unavailable (private mode); session still works */
    }
  };

  const boot = async () => {
    const configRes = await fetch(`${API_BASE}${PUBLIC_PATH}/${widgetId}/config`, {
      credentials: 'include',
    });

    if (configRes.status === 204) {
      console.warn('Lety widget: this widget is unavailable (disabled or its agent is inactive).');
      return;
    }
    if (configRes.status === 403) {
      console.warn(`Lety widget: domain "${location.hostname}" is not allowed for this widget.`);
      return;
    }
    if (!configRes.ok) {
      console.warn(`Lety widget: failed to load configuration (${configRes.status}).`);
      return;
    }

    const config = (await configRes.json()) as DisplayConfig;

    const sessionRes = await fetch(`${API_BASE}${PUBLIC_PATH}/${widgetId}/session`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: readVisitorId() }),
    });

    if (!sessionRes.ok) {
      console.warn(`Lety widget: could not start a session (${sessionRes.status}).`);
      return;
    }

    const session = (await sessionRes.json()) as SessionResponse;
    storeVisitorId(session.visitorId);

    render(config, session);
  };

  const render = (config: DisplayConfig, session: SessionResponse) => {
    const host = document.createElement('div');
    host.setAttribute('data-lety-widget', '');
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .lety-root { position: fixed; bottom: 20px; z-index: 2147483000; }
      .lety-root[data-pos="right"] { right: 20px; }
      .lety-root[data-pos="left"] { left: 20px; }
      .lety-bubble {
        position: relative; width: 56px; height: 56px; border-radius: 50%; border: none;
        cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fff;
        box-shadow: 0 6px 20px rgba(0,0,0,.2); transition: transform .15s;
      }
      .lety-bubble:hover { transform: scale(1.05); }
      .lety-unread {
        position: absolute; top: 0; right: 0; width: 12px; height: 12px; border-radius: 50%;
        background: #ef4444; border: 2px solid #fff; display: none;
      }
      .lety-bubble.has-unread .lety-unread { display: block; }
      .lety-panel {
        position: absolute; bottom: 72px; width: 384px; height: 560px; max-height: 80vh;
        max-width: calc(100vw - 40px); border: none; border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0,0,0,.18); opacity: 0; pointer-events: none;
        transform: translateY(12px) scale(.98); transition: opacity .18s, transform .18s;
      }
      .lety-root[data-pos="right"] .lety-panel { right: 0; }
      .lety-root[data-pos="left"] .lety-panel { left: 0; }
      .lety-panel.open { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }
    `;

    const root = document.createElement('div');
    root.className = 'lety-root';
    root.dataset.pos = config.position === 'left' ? 'left' : 'right';

    const iframe = document.createElement('iframe');
    iframe.className = 'lety-panel';
    iframe.title = config.assistantName || 'Chat';
    iframe.allow = 'autoplay';
    iframe.src = `${APP_ORIGIN}/?widgetId=${encodeURIComponent(widgetId)}&mode=bubble`;

    const bubble = document.createElement('button');
    bubble.className = 'lety-bubble';
    bubble.style.background = config.primaryColor;
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.innerHTML = `
      <span class="lety-unread"></span>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>`;

    root.append(iframe, bubble);
    shadow.append(style, root);
    document.body.appendChild(host);

    let open = false;
    const setOpen = (value: boolean) => {
      open = value;
      iframe.classList.toggle('open', value);
      if (value) bubble.classList.remove('has-unread');
      iframe.contentWindow?.postMessage({ type: 'lety:visibility', open: value }, APP_ORIGIN);
    };

    bubble.addEventListener('click', () => setOpen(!open));

    window.addEventListener('message', (event: MessageEvent) => {
      if (event.origin !== APP_ORIGIN) return;
      const data = event.data as { type?: string } | null;
      if (!data?.type) return;

      switch (data.type) {
        case 'lety:app-ready':
          iframe.contentWindow?.postMessage(
            { type: 'lety:bootstrap', config, token: session.token, apiBase: API_BASE },
            APP_ORIGIN,
          );
          if (config.autoOpen) setOpen(true);
          break;
        case 'lety:close':
          setOpen(false);
          break;
        case 'lety:notify':
          if (!open) bubble.classList.add('has-unread');
          break;
      }
    });
  };

  const start = () => {
    void boot().catch((error) => {
      console.warn('Lety widget: failed to initialize.', error);
    });
  };

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
