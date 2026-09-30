import { DisplayConfig, SessionResponse } from './types';

declare const __LETY_API_BASE__: string;

export const API_BASE = __LETY_API_BASE__;
const PUBLIC_PATH = '/api/v1/public/widgets';
const EMBED_ORIGIN_HEADER = 'x-lety-embed-origin';

const isUsableOrigin = (value: string | null | undefined): value is string =>
  Boolean(value) && value !== 'null';

export const resolveEmbedOrigin = (): string | null => {
  if (window.self === window.top) return null;
  const ancestors = location.ancestorOrigins;
  const fromAncestors = ancestors && ancestors.length > 0 ? ancestors[0] : null;
  if (isUsableOrigin(fromAncestors)) return fromAncestors;
  try {
    const fromReferrer = document.referrer ? new URL(document.referrer).origin : null;
    return isUsableOrigin(fromReferrer) ? fromReferrer : null;
  } catch {
    return null;
  }
};

const embedHeaders = (embedOrigin: string | null): Record<string, string> =>
  embedOrigin ? { [EMBED_ORIGIN_HEADER]: embedOrigin } : {};

export type ConfigResult =
  | { status: 'ok'; config: DisplayConfig }
  | { status: 'unavailable' }
  | { status: 'forbidden' }
  | { status: 'error' };

export const fetchConfig = async (
  apiBase: string,
  widgetId: string,
  embedOrigin: string | null = null,
): Promise<ConfigResult> => {
  const res = await fetch(`${apiBase}${PUBLIC_PATH}/${widgetId}/config`, {
    credentials: 'include',
    headers: embedHeaders(embedOrigin),
  });
  if (res.status === 204) return { status: 'unavailable' };
  if (res.status === 403) return { status: 'forbidden' };
  if (!res.ok) return { status: 'error' };
  return { status: 'ok', config: (await res.json()) as DisplayConfig };
};

export const createSession = async (
  apiBase: string,
  widgetId: string,
  visitorId?: string,
  embedOrigin: string | null = null,
): Promise<SessionResponse | null> => {
  const res = await fetch(`${apiBase}${PUBLIC_PATH}/${widgetId}/session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...embedHeaders(embedOrigin) },
    body: JSON.stringify({ visitorId }),
  });
  if (!res.ok) return null;
  return (await res.json()) as SessionResponse;
};
