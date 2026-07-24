import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { initPixel, pixelPageView } from '../lib/metaPixel';

/**
 * Boots the Meta Pixel once the admin-configured ID arrives, and fires a
 * PageView on every SPA route change (the pixel only sees the first load
 * by itself — client-side navigations are invisible without this).
 *
 * Renders nothing. With no Pixel ID configured it does nothing at all.
 */
export const MetaPixelManager: React.FC = () => {
  const { metaPixelId } = useSettings();
  const { pathname } = useLocation();
  const bootedRef = useRef(false);
  const lastPathRef = useRef(pathname);

  useEffect(() => {
    if (metaPixelId && !bootedRef.current) {
      initPixel(metaPixelId);
      bootedRef.current = true;
      lastPathRef.current = pathname;
    }
  }, [metaPixelId, pathname]);

  useEffect(() => {
    // init already fired the first PageView; only report real changes.
    if (bootedRef.current && pathname !== lastPathRef.current) {
      lastPathRef.current = pathname;
      pixelPageView();
    }
  }, [pathname]);

  return null;
};
