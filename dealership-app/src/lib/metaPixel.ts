/**
 * Meta (Facebook) Pixel integration.
 *
 * The Pixel ID lives in GlobalSettings (Admin → Settings → Meta Pixel ID).
 * Nothing loads until an ID is configured — with the field empty this whole
 * module is a set of no-ops, so the site ships ad-ready but tracker-free.
 *
 * fbq's standard bootstrap queues calls made before the script finishes
 * loading, so trackPixel is safe to call immediately after initPixel.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

let initialised = false;

export const initPixel = (pixelId: string): void => {
  if (!pixelId || initialised || typeof window === 'undefined') return;
  initialised = true;

  // Standard Meta Pixel bootstrap (the official snippet, minus IE8 shims).
  const w = window as Window;
  if (!w.fbq) {
    const fbq: any = (...args: unknown[]) => {
      (fbq.callMethod ? fbq.callMethod : fbq.queue.push).apply(fbq, args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    w.fbq = fbq;
    w._fbq = fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  w.fbq!('init', pixelId);
  w.fbq!('track', 'PageView');
};

/** Standard or custom event. No-op until initPixel has run with a real ID. */
export const trackPixel = (event: string, params?: Record<string, unknown>): void => {
  if (!initialised || typeof window === 'undefined' || !window.fbq) return;
  if (params) window.fbq('track', event, params);
  else window.fbq('track', event);
};

/** SPA route-change page view. */
export const pixelPageView = (): void => {
  if (!initialised || typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', 'PageView');
};
