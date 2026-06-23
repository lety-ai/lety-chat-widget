import { useEffect } from 'react';

export interface LetyWidgetProps {
  /** Public widget id from the dashboard (e.g. "w_xxx"). */
  widgetId: string;
  /** Override the loader script URL. Defaults to the Lety CDN. */
  scriptUrl?: string;
}

interface LetyLoaderApi {
  mount: (options: { widgetId: string }) => void;
  unmount: () => void;
}

declare global {
  interface Window {
    LetyWidget?: LetyLoaderApi;
  }
}

const DEFAULT_SCRIPT_URL = 'https://cdn.lety.ai/widget.js';
const LOADER_MARKER = 'data-lety-loader';

let loaderPromise: Promise<void> | null = null;

const loadLoader = (src: string): Promise<void> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve();
  if (window.LetyWidget) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[${LOADER_MARKER}]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => {
        loaderPromise = null;
        reject(new Error('Failed to load Lety widget loader'));
      });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(LOADER_MARKER, '');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      loaderPromise = null;
      reject(new Error('Failed to load Lety widget loader'));
    });
    document.head.appendChild(script);
  });

  return loaderPromise;
};

/**
 * Embeds the Lety chat widget. Uses the same CDN loader as the script-tag
 * install under the hood, so it behaves identically. Only one widget instance
 * exists on the page even if the component is mounted more than once, and
 * unmounting removes it cleanly.
 */
export function LetyWidget({ widgetId, scriptUrl = DEFAULT_SCRIPT_URL }: LetyWidgetProps): null {
  useEffect(() => {
    let active = true;

    loadLoader(scriptUrl)
      .then(() => {
        if (active) window.LetyWidget?.mount({ widgetId });
      })
      .catch((error: unknown) => {
        console.warn('Lety widget:', error);
      });

    return () => {
      active = false;
      window.LetyWidget?.unmount();
    };
  }, [widgetId, scriptUrl]);

  return null;
}

export default LetyWidget;
