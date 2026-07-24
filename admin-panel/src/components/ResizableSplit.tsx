import React, { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  /** Stable key — each screen remembers its own width per device. */
  storageKey: string;
  left: React.ReactNode;
  right: React.ReactNode;
  /** Which pane holds the measured width; the other one flexes. */
  fixedSide?: 'left' | 'right';
  /** Width in px of the fixed pane. */
  defaultRightWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
  className?: string;
}

/**
 * Two-pane layout with a draggable divider, for admin screens that pair a
 * list with a detail panel.
 *
 * The sidebar was the only resizable thing in the panel; every other split
 * was a hardcoded width, so admins could not give the detail pane more room
 * on a wide screen. Widths persist per screen per device.
 *
 * Below lg the panes stack (the divider is desktop-only), matching how these
 * screens already behaved on mobile.
 */
const ResizableSplit: React.FC<Props> = ({
  storageKey,
  left,
  right,
  fixedSide = 'right',
  defaultRightWidth = 500,
  minRightWidth = 380,
  maxRightWidth = 900,
  className = '',
}) => {
  const key = `adminSplit:${storageKey}`;

  const [width, setWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(key) || 0);
    return stored >= minRightWidth && stored <= maxRightWidth ? stored : defaultRightWidth;
  });
  const [resizing, setResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  );
  const widthRef = useRef(width);
  widthRef.current = width;

  // Keep the pane usable if the window shrinks below the stored width, and
  // track the lg breakpoint so the pixel width is dropped/restored on cross.
  useEffect(() => {
    const onResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      const cap = Math.min(maxRightWidth, Math.max(minRightWidth, window.innerWidth - 420));
      if (widthRef.current > cap) setWidth(cap);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [maxRightWidth, minRightWidth]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
    const startX = e.clientX;
    const startW = widthRef.current;

    const onMove = (ev: MouseEvent) => {
      // When the RIGHT pane is the measured one, dragging left must widen it —
      // hence the inverted delta. A left-fixed pane follows the cursor.
      const delta = ev.clientX - startX;
      const raw = fixedSide === 'right' ? startW - delta : startW + delta;
      const next = Math.min(
        Math.min(maxRightWidth, window.innerWidth - 420),
        Math.max(minRightWidth, raw)
      );
      widthRef.current = next;
      setWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      try { localStorage.setItem(key, String(widthRef.current)); } catch { /* non-fatal */ }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [key, maxRightWidth, minRightWidth, fixedSide]);

  // Only apply the pixel width at lg+; below that the panes stack full-width.
  const fixedStyle = isDesktop ? { width } : undefined;

  return (
    <div className={`flex flex-col lg:flex-row ${className}`}>
      <div
        style={fixedSide === 'left' ? fixedStyle : undefined}
        className={fixedSide === 'left'
          ? 'w-full lg:w-auto shrink-0 flex flex-col min-h-0'
          : 'flex-1 min-w-0 flex flex-col'}
      >
        {left}
      </div>

      {/* Divider — desktop only; double-click restores the default width. */}
      <div
        onMouseDown={startResize}
        onDoubleClick={() => {
          setWidth(defaultRightWidth);
          try { localStorage.setItem(key, String(defaultRightWidth)); } catch { /* non-fatal */ }
        }}
        title="Drag to resize · double-click to reset"
        className={`hidden lg:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center group ${
          resizing ? 'bg-gold/40' : 'bg-border hover:bg-gold/25'
        } transition-colors`}
      >
        <span className={`h-8 w-0.5 rounded-full ${resizing ? 'bg-gold' : 'bg-text-tertiary/40 group-hover:bg-gold'}`} />
      </div>

      <div
        style={fixedSide === 'right' ? fixedStyle : undefined}
        className={fixedSide === 'right'
          ? 'w-full lg:w-auto shrink-0 flex flex-col min-h-0'
          : 'flex-1 min-w-0 flex flex-col'}
      >
        {right}
      </div>
    </div>
  );
};

export default ResizableSplit;
