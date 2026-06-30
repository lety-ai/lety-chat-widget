// Lety widget loader. Dependency-free. Two entry points share the exact same
// logic:
//   1. Script tag:  <script src="https://cdn.lety.ai/widget.js" data-widget-id="w_xxx" async></script>
//   2. Programmatic: window.LetyWidget.mount({ widgetId }) / window.LetyWidget.unmount()
//      (used by the @lety-ai/react-widget-chat package).
//
// The loader runs on the HOST page, so its fetches to the public widget API
// carry the real site Origin — that is what enforces the allowed-domains rule.
// It resolves the config + a visitor session token, then boots the chat iframe
// (the app) inside a Shadow DOM and hands it the token via postMessage. When the
// widget is blocked (disabled, inactive agent, or non-allowed domain) it logs a
// clear console message and renders nothing.

declare const __LETY_WIDGET_APP_ORIGIN__: string;
declare const __LETY_API_BASE__: string;
declare const __LETY_TURNSTILE_SITE_KEY__: string;

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

export interface MountOptions {
  widgetId: string;
  apiBase?: string;
  appOrigin?: string;
}

interface LetyWidgetApi {
  mount: (options: MountOptions) => void;
  unmount: () => void;
}

const DEFAULT_APP_ORIGIN = __LETY_WIDGET_APP_ORIGIN__;
const DEFAULT_API_BASE = __LETY_API_BASE__;
const TURNSTILE_SITE_KEY = __LETY_TURNSTILE_SITE_KEY__;
const PUBLIC_PATH = '/api/v1/public/widgets';

const TURNSTILE_SCRIPT =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_TIMEOUT_MS = 30_000;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => void;
};

let turnstileReady: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (turnstileReady) return turnstileReady;
  turnstileReady = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com/turnstile"]',
    );
    if (existing) {
      if ((window as { turnstile?: TurnstileApi }).turnstile) resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = TURNSTILE_SCRIPT;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile script failed to load'));
    document.head.appendChild(s);
  });
  return turnstileReady;
}

async function getTurnstileToken(): Promise<string | undefined> {
  if (!TURNSTILE_SITE_KEY) return undefined;
  try {
    await loadTurnstile();
    return await new Promise<string>((resolve, reject) => {
      const container = document.createElement('div');
      container.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden;';
      document.body.appendChild(container);
      const timer = setTimeout(() => reject(new Error('Turnstile timeout')), TURNSTILE_TIMEOUT_MS);
      const done = (fn: () => void) => {
        clearTimeout(timer);
        container.remove();
        fn();
      };
      const ts = (window as { turnstile?: TurnstileApi }).turnstile;
      if (!ts) {
        done(() => reject(new Error('Turnstile not available')));
        return;
      }
      ts.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        size: 'invisible',
        callback: (token: string) => done(() => resolve(token)),
        'error-callback': () => done(() => reject(new Error('Turnstile challenge error'))),
        'expired-callback': () => done(() => reject(new Error('Turnstile token expired'))),
      });
    });
  } catch {
    return undefined;
  }
}

let teardown: (() => void) | null = null;

const visitorKeyFor = (widgetId: string) => `lety:visitor:${widgetId}`;

const readVisitorId = (key: string): string | undefined => {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
};

const storeVisitorId = (key: string, id: string) => {
  try {
    localStorage.setItem(key, id);
  } catch {
    /* storage may be unavailable (private mode); session still works */
  }
};

function mount(options: MountOptions): void {
  // Single instance: a second mount() is a no-op until unmount() is called.
  if (teardown) return;

  const widgetId = options.widgetId?.trim();
  if (!widgetId) {
    console.warn('Lety widget: missing widgetId.');
    return;
  }

  const apiBase = options.apiBase || DEFAULT_API_BASE;
  const appOrigin = options.appOrigin || DEFAULT_APP_ORIGIN;
  const appOriginBase = new URL(appOrigin).origin;
  const visitorKey = visitorKeyFor(widgetId);

  let cancelled = false;
  // Until boot finishes, unmount() just flips this flag so render() is skipped.
  teardown = () => {
    cancelled = true;
  };

  const releaseTeardown = () => {
    if (!cancelled) teardown = null;
  };

  const boot = async () => {
    const configRes = await fetch(`${apiBase}${PUBLIC_PATH}/${widgetId}/config`, {
      credentials: 'include',
    });

    if (configRes.status === 204) {
      console.warn('Lety widget: this widget is unavailable (disabled or its agent is inactive).');
      releaseTeardown();
      return;
    }
    if (configRes.status === 403) {
      console.warn(`Lety widget: domain "${location.hostname}" is not allowed for this widget.`);
      releaseTeardown();
      return;
    }
    if (!configRes.ok) {
      console.warn(`Lety widget: failed to load configuration (${configRes.status}).`);
      releaseTeardown();
      return;
    }

    const config = (await configRes.json()) as DisplayConfig;

    const turnstileToken = await getTurnstileToken();

    const sessionBody: Record<string, string> = {};
    const savedVisitorId = readVisitorId(visitorKey);
    if (savedVisitorId) sessionBody.visitorId = savedVisitorId;
    if (turnstileToken) sessionBody.turnstileToken = turnstileToken;

    const sessionRes = await fetch(`${apiBase}${PUBLIC_PATH}/${widgetId}/session`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionBody),
    });

    if (!sessionRes.ok) {
      console.warn(`Lety widget: could not start a session (${sessionRes.status}).`);
      releaseTeardown();
      return;
    }

    const session = (await sessionRes.json()) as SessionResponse;
    storeVisitorId(visitorKey, session.visitorId);

    if (cancelled) return;
    render(widgetId, appOrigin, appOriginBase, apiBase, config, session);
  };

  void boot().catch((error) => {
    console.warn('Lety widget: failed to initialize.', error);
    releaseTeardown();
  });
}

function unmount(): void {
  teardown?.();
  teardown = null;
}

function render(
  widgetId: string,
  appOrigin: string,
  appOriginBase: string,
  apiBase: string,
  config: DisplayConfig,
  session: SessionResponse,
): void {
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
  iframe.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups');
  iframe.src = `${appOrigin}/?widgetId=${encodeURIComponent(widgetId)}&mode=bubble`;

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
    iframe.contentWindow?.postMessage({ type: 'lety:visibility', open: value }, appOriginBase);
  };

  bubble.addEventListener('click', () => setOpen(!open));

  let tokenRef = session.token;

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== appOriginBase) return;
    if (event.source !== iframe.contentWindow) return;
    const data = event.data as { type?: string } | null;
    if (!data?.type) return;

    switch (data.type) {
      case 'lety:app-ready':
        iframe.contentWindow?.postMessage(
          { type: 'lety:bootstrap', config, token: tokenRef, apiBase },
          appOriginBase,
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
  };

  window.addEventListener('message', onMessage);

  // Replace the pre-render teardown with the full cleanup.
  teardown = () => {
    window.removeEventListener('message', onMessage);
    host.remove();
    tokenRef = '';
  };
}

const api: LetyWidgetApi = { mount, unmount };
(window as Window & { LetyWidget?: LetyWidgetApi }).LetyWidget = api;

// Auto-init when embedded as a plain script tag with data-widget-id.
const currentScript =
  (document.currentScript as HTMLScriptElement | null) ||
  document.querySelector<HTMLScriptElement>('script[data-widget-id]');
const scriptWidgetId = currentScript?.getAttribute('data-widget-id')?.trim();
if (scriptWidgetId) {
  if (document.body) {
    mount({ widgetId: scriptWidgetId });
  } else {
    document.addEventListener('DOMContentLoaded', () => mount({ widgetId: scriptWidgetId }), {
      once: true,
    });
  }
}

export { mount, unmount };
