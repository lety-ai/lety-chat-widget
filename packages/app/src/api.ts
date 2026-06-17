import { DisplayConfig, SessionResponse } from './types';

declare const __LETY_API_BASE__: string;

export const API_BASE = __LETY_API_BASE__;
const PUBLIC_PATH = '/api/v1/public/widgets';

export type ConfigResult =
  | { status: 'ok'; config: DisplayConfig }
  | { status: 'unavailable' }
  | { status: 'forbidden' }
  | { status: 'error' };

export const fetchConfig = async (apiBase: string, widgetId: string): Promise<ConfigResult> => {
  const res = await fetch(`${apiBase}${PUBLIC_PATH}/${widgetId}/config`, {
    credentials: 'include',
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
): Promise<SessionResponse | null> => {
  const res = await fetch(`${apiBase}${PUBLIC_PATH}/${widgetId}/session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
  });
  if (!res.ok) return null;
  return (await res.json()) as SessionResponse;
};
