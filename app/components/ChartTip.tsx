'use client';
import { useEffect, useRef } from 'react';

// One shared tooltip for every chart mark that has a data-tip attribute.
// Lines in data-tip are separated by "|"; the first line is shown in bold.
export default function ChartTip() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tip = ref.current!;
    let active: Element | null = null;
    const show = (el: Element, x: number, y: number) => {
      if (el !== active) {
        active = el;
        const [head, ...rest] = (el.getAttribute('data-tip') || '').split('|');
        tip.replaceChildren();
        const b = document.createElement('b'); b.textContent = head; tip.appendChild(b);
        for (const line of rest) { const d = document.createElement('div'); d.textContent = line; tip.appendChild(d); }
        document.querySelectorAll('.hot').forEach((n) => n.classList.remove('hot'));
        el.classList.add('hot');
        tip.hidden = false;
      }
      const w = tip.offsetWidth, h = tip.offsetHeight;
      const left = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8);
      const top = y - h - 14 < 8 ? y + 18 : y - h - 14;
      tip.style.transform = `translate(${left}px, ${top}px)`;
    };
    const hide = () => { active = null; tip.hidden = true; document.querySelectorAll('.hot').forEach((n) => n.classList.remove('hot')); };
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element)?.closest?.('[data-tip]');
      if (el) show(el, e.clientX, e.clientY); else if (active) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as Element)?.closest?.('[data-tip]');
      if (el) { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerdown', onMove);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onMove);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      window.removeEventListener('scroll', hide);
    };
  }, []);
  return <div ref={ref} className="chart-tip" role="tooltip" hidden />;
}
