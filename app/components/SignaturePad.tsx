'use client';
import { useEffect, useRef } from 'react';
import type { Stroke } from '@/lib/carDiagram';

export const SIG_W = 600;
export const SIG_H = 220;

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.strokeStyle = '#0b1f4a';
  ctx.fillStyle = '#0b1f4a';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (s.length === 1) { ctx.beginPath(); ctx.arc(s[0].x, s[0].y, 2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
    ctx.stroke();
  }
}

// Turns the signature into a JPEG on a white background for saving.
export async function renderSignature(strokes: Stroke[], scale = 2): Promise<{ blob: Blob; w: number; h: number }> {
  const c = document.createElement('canvas');
  c.width = SIG_W * scale; c.height = SIG_H * scale;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(scale, scale);
  paint(ctx, strokes);
  const blob = await new Promise<Blob>((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('blob'))), 'image/jpeg', 0.9));
  return { blob, w: c.width, h: c.height };
}

export default function SignaturePad({ strokes, onChange }: { strokes: Stroke[]; onChange: (s: Stroke[]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cur = useRef<Stroke | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  function redraw(extra?: Stroke) {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.scale(c.width / SIG_W, c.height / SIG_H);
    paint(ctx, extra ? [...strokesRef.current, extra] : strokesRef.current);
  }
  useEffect(() => { redraw(); }, [strokes]);

  const pt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.round(((e.clientX - r.left) / r.width) * SIG_W * 10) / 10, y: Math.round(((e.clientY - r.top) / r.height) * SIG_H * 10) / 10 };
  };

  return (
    <div>
      <div className="sig-board">
        <span className="sig-line" aria-hidden="true" />
        <span className="sig-x" aria-hidden="true">✕</span>
        <canvas
          ref={ref}
          id="sigPad"
          tabIndex={-1}
          width={SIG_W * 2}
          height={SIG_H * 2}
          aria-label="Signature area"
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); cur.current = [pt(e)]; redraw(cur.current); }}
          onPointerMove={(e) => {
            if (!cur.current) return; e.preventDefault();
            const p = pt(e), last = cur.current[cur.current.length - 1];
            if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
            cur.current.push(p); redraw(cur.current);
          }}
          onPointerUp={() => { if (!cur.current) return; const s = cur.current; cur.current = null; onChange([...strokesRef.current, s]); }}
          onPointerCancel={() => { if (!cur.current) return; const s = cur.current; cur.current = null; onChange([...strokesRef.current, s]); }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" className="btn" disabled={!strokes.length} onClick={() => onChange([])}>Clear signature</button>
      </div>
    </div>
  );
}
