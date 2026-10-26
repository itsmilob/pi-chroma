import { useEffect, useRef } from 'react';

// Pan and zoom input for a graph area, for mouse, touch and trackpad alike.
//
//   onPan(dx, dy)     screen pixels moved by one finger / the mouse, or by the
//                     midpoint of a pinch
//   onZoom(factor)    >1 zooms in, <1 out. Wheel and pinch both come through
//                     here; callers zoom around their view center.
//   onDragChange(on)  true while a finger or the mouse button is down
//
// The element must also carry `touch-action: none` (Tailwind `touch-none`);
// otherwise the browser scrolls or zooms the page instead of delivering
// touches. Descendants marked `data-no-gesture` (scrubbers, buttons) are left
// alone. The wheel listener is native and non-passive: React's own onWheel is
// passive, so it cannot stop the page from scrolling underneath.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function useGestures(ref, handlers) {
  const live = useRef(handlers);
  live.current = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const pointers = new Map(); // pointerId -> { x, y }
    let pinch = null; // { dist, x, y } of the last two-finger measurement

    const measure = () => {
      const [a, b] = [...pointers.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    const onWheel = (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const delta = clamp(e.deltaY * unit, -300, 300);
      live.current.onZoom?.(Math.exp(-delta * 0.0016)); // one mouse notch is about 15%
    };

    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest?.('[data-no-gesture]')) return;
      el.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) live.current.onDragChange?.(true);
      if (pointers.size === 2) pinch = measure();
    };

    const onMove = (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        live.current.onPan?.(dx, dy);
      } else if (pointers.size === 2 && pinch) {
        const now = measure();
        live.current.onZoom?.(now.dist / pinch.dist);
        live.current.onPan?.(now.x - pinch.x, now.y - pinch.y);
        pinch = now;
      }
    };

    const onUp = (e) => {
      if (!pointers.delete(e.pointerId)) return;
      pinch = pointers.size === 2 ? measure() : null;
      if (pointers.size === 0) live.current.onDragChange?.(false);
    };

    // Safari pinches the whole page through its own gesture events
    const stop = (e) => e.preventDefault();

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('gesturestart', stop);
    el.addEventListener('gesturechange', stop);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('gesturestart', stop);
      el.removeEventListener('gesturechange', stop);
    };
  }, [ref]);
}
