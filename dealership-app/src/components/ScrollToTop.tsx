import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Opens every new page from the top.
 *
 * Without this, an SPA carries the scroll offset across route changes: a
 * customer halfway down the homepage who taps a car lands in the middle of
 * the detail page's specs table, and "See all" opens the listings mid-page.
 *
 * Deliberately narrow about when it fires:
 * - POP navigations (back/forward) are left alone so the browser's native
 *   position restoration returns the customer to where they were on the list.
 * - Search-param-only changes are left alone so sidebar filter clicks do not
 *   yank the page back to the top.
 */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    const pathChanged = pathname !== prevPathname.current;
    prevPathname.current = pathname;

    if (pathChanged && navigationType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [pathname, navigationType]);

  return null;
};

export default ScrollToTop;
