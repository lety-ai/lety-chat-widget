import { io, Socket } from 'socket.io-client';

import { API_BASE, createSession, fetchConfig } from './api';
import { playNotificationSound } from './sound';
import { Bootstrap, ChatMessage, ChatRole, DisplayConfig } from './types';

const params = new URLSearchParams(location.search);
const widgetId = params.get('widgetId') ?? '';
const mode = params.get('mode') === 'bubble' ? 'bubble' : 'inline';
const PARENT = '*';

let socket: Socket | null = null;
let config: DisplayConfig | null = null;
let visible = mode === 'inline';

const genId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m_${Date.now()}_${Math.random().toString(36).slice(2)}`;

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
    /* ignore */
  }
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const extractText = (payload: unknown): string => {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const candidate = obj.message ?? obj.content ?? obj.text;
    if (typeof candidate === 'string') return candidate;
  }
  return '';
};

const roleFromType = (type: unknown): ChatRole => {
  if (type === 'human' || type === 'user') return 'user';
  if (type === 'error' || type === 'system') return 'system';
  return 'agent';
};

const els = {
  root: document.createElement('div'),
  messages: null as HTMLDivElement | null,
  input: null as HTMLTextAreaElement | null,
};

const renderShell = () => {
  const style = document.createElement('style');
  style.textContent = `
    :root { --lety-primary:#18A37F; --lety-bg:#fff; --lety-text:#1f2937; }
    * { box-sizing: border-box; }
    html, body { margin:0; height:100%; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .lety { display:flex; flex-direction:column; height:100vh; background:var(--lety-bg); color:var(--lety-text); border-radius:16px; overflow:hidden; }
    .lety-header { display:flex; align-items:center; gap:10px; padding:14px 16px; background:var(--lety-primary); color:#fff; }
    .lety-avatar { width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; font-weight:600; overflow:hidden; }
    .lety-avatar img { width:100%; height:100%; object-fit:cover; }
    .lety-title { font-size:14px; font-weight:600; line-height:1.1; }
    .lety-status { font-size:11px; opacity:.85; }
    .lety-close { margin-left:auto; background:none; border:none; color:#fff; cursor:pointer; opacity:.9; font-size:18px; }
    .lety-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:8px; }
    .lety-msg { max-width:80%; padding:8px 12px; border-radius:14px; font-size:13px; line-height:1.4; white-space:pre-wrap; word-wrap:break-word; }
    .lety-msg.user { align-self:flex-end; background:var(--lety-primary); color:#fff; border-bottom-right-radius:4px; }
    .lety-msg.agent { align-self:flex-start; background:#f1f1f3; color:var(--lety-text); border-bottom-left-radius:4px; }
    .lety-msg.system { align-self:center; background:#fef2f2; color:#b91c1c; font-size:12px; }
    .lety-form { display:flex; gap:8px; padding:10px 12px; border-top:1px solid #ececf0; }
    .lety-input { flex:1; resize:none; border:1px solid #e2e2e6; border-radius:10px; padding:8px 10px; font:inherit; font-size:13px; max-height:96px; }
    .lety-input:focus { outline:none; border-color:var(--lety-primary); }
    .lety-send { border:none; background:var(--lety-primary); color:#fff; width:38px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .lety-send:disabled { opacity:.5; cursor:default; }
  `;

  els.root.className = 'lety';
  els.root.innerHTML = `
    <div class="lety-header">
      <span class="lety-avatar" data-avatar></span>
      <div>
        <div class="lety-title" data-title>Assistant</div>
        <div class="lety-status">Online</div>
      </div>
      <button class="lety-close" data-close aria-label="Close">×</button>
    </div>
    <div class="lety-messages" data-messages></div>
    <form class="lety-form" data-form>
      <textarea class="lety-input" data-input rows="1" placeholder="Type your message..."></textarea>
      <button class="lety-send" type="submit" aria-label="Send">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </form>
  `;

  document.head.appendChild(style);
  document.body.appendChild(els.root);

  els.messages = els.root.querySelector<HTMLDivElement>('[data-messages]');
  els.input = els.root.querySelector<HTMLTextAreaElement>('[data-input]');

  els.root.querySelector('[data-close]')?.addEventListener('click', () => {
    if (mode === 'bubble') parent.postMessage({ type: 'lety:close' }, PARENT);
  });

  const form = els.root.querySelector<HTMLFormElement>('[data-form]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    send();
  });
  els.input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
};

const applyConfig = (cfg: DisplayConfig) => {
  config = cfg;
  const r = document.documentElement;
  r.style.setProperty('--lety-primary', cfg.primaryColor);
  r.style.setProperty('--lety-bg', cfg.backgroundColor);
  r.style.setProperty('--lety-text', cfg.textColor);

  const title = els.root.querySelector<HTMLDivElement>('[data-title]');
  if (title) title.textContent = cfg.assistantName;

  const avatar = els.root.querySelector<HTMLSpanElement>('[data-avatar]');
  if (avatar) {
    avatar.innerHTML = cfg.avatarUrl
      ? `<img src="${escapeHtml(cfg.avatarUrl)}" alt="" />`
      : escapeHtml((cfg.assistantName || 'A').charAt(0).toUpperCase());
  }
  if (els.input) els.input.placeholder = cfg.inputPlaceholder;

  if (cfg.welcomeMessage) {
    appendMessage({ id: genId(), role: 'agent', text: cfg.welcomeMessage });
  }
};

const appendMessage = (message: ChatMessage) => {
  if (!els.messages) return;
  const node = document.createElement('div');
  node.className = `lety-msg ${message.role}`;
  node.textContent = message.text;
  els.messages.appendChild(node);
  els.messages.scrollTop = els.messages.scrollHeight;
};

const handleIncoming = (payload: unknown, fallbackRole: ChatRole) => {
  const text = extractText(payload);
  if (!text) return;
  const role =
    payload && typeof payload === 'object'
      ? roleFromType((payload as Record<string, unknown>).type)
      : fallbackRole;
  appendMessage({ id: genId(), role: role === 'user' ? 'agent' : role, text });

  if (config?.soundEnabled) playNotificationSound();
  if (!visible && mode === 'bubble') parent.postMessage({ type: 'lety:notify' }, PARENT);
};

const send = () => {
  const value = els.input?.value.trim();
  if (!value || !socket) return;
  appendMessage({ id: genId(), role: 'user', text: value });
  socket.emit('message', { message: value });
  if (els.input) els.input.value = '';
};

const connect = (apiBase: string, token: string) => {
  socket = io(`${apiBase}/widget-chat`, {
    transports: ['websocket'],
    auth: { token },
  });

  socket.on('connect_error', () => {
    appendMessage({ id: genId(), role: 'system', text: 'Connection error. Please try again.' });
  });

  socket.on('chatHistory', (messages: unknown[]) => {
    if (!Array.isArray(messages)) return;
    for (const item of messages) {
      const text = extractText(item);
      if (!text) continue;
      const role = roleFromType((item as Record<string, unknown>)?.type);
      appendMessage({ id: genId(), role, text });
    }
  });

  socket.on('agentResponse', (payload: unknown) => handleIncoming(payload, 'agent'));
  socket.on('newMessage', (payload: unknown) => handleIncoming(payload, 'agent'));
};

const blocked = (message: string) => {
  console.warn(`Lety widget: ${message}`);
  if (mode === 'bubble') parent.postMessage({ type: 'lety:blocked', message }, PARENT);
};

const init = (cfg: DisplayConfig, apiBase: string, token: string) => {
  applyConfig(cfg);
  connect(apiBase, token);
};

const bootInline = async () => {
  if (!widgetId) return blocked('missing widgetId.');
  const result = await fetchConfig(API_BASE, widgetId);
  if (result.status === 'unavailable') return blocked('widget is unavailable.');
  if (result.status === 'forbidden')
    return blocked(`domain "${location.hostname}" is not allowed for this widget.`);
  if (result.status === 'error') return blocked('failed to load configuration.');

  const session = await createSession(API_BASE, widgetId, readVisitorId());
  if (!session) return blocked('could not start a session.');
  storeVisitorId(session.visitorId);
  init(result.config, API_BASE, session.token);
};

const bootBubble = () => {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string } & Partial<Bootstrap> & { open?: boolean };
    if (!data?.type) return;
    if (data.type === 'lety:bootstrap' && data.config && data.token && data.apiBase) {
      init(data.config, data.apiBase, data.token);
    } else if (data.type === 'lety:visibility') {
      visible = Boolean(data.open);
      if (visible) els.input?.focus();
    }
  });
  parent.postMessage({ type: 'lety:app-ready' }, PARENT);
};

renderShell();
if (mode === 'bubble') {
  bootBubble();
} else {
  void bootInline().catch(() => blocked('failed to initialize.'));
}
