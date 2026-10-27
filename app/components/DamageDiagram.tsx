'use client';
import { useEffect, useRef } from 'react';
import { CAR_SVG_URL, DIAGRAM_H, DIAGRAM_W, drawStrokes, type Stroke } from '@/lib/carDiagram';

// Lets the inspector draw in red on the car outline with a finger or mouse.
export default function DamageDiagram({ strokes, onChange }: { strokes: Stroke[]; onChange: (s: Stroke[]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<Stroke | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  function redraw(extra?: Stroke) {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.scale(c.width / DIAGRAM_W, c.height / DIAGRAM_H);
    drawStrokes(ctx, extra ? [...strokesRef.current, extra] : strokesRef.current);
  }

  useEffect(() => { redraw(); }, [strokes]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * DIAGRAM_W, y: ((e.clientY - r.top) / r.height) * DIAGRAM_H };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = [point(e)];
    redraw(current.current);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!current.current) return;
    e.preventDefault();
    const p = point(e), last = current.current[current.current.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
    current.current.push({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
    redraw(current.current);
  }
  function up() {
    if (!current.current) return;
    const s = current.current; current.current = null;
    onChange([...strokesRef.current, s]);
  }

  return (
    <div className="diagram">
      <div className="diagram-head">
        <div>
          <b>Mark on the vehicle</b>
          <p className="hint" style={{ margin: 0 }}>Draw with your finger in red where the damage, dent or scratch is.</p>
        </div>
        <div className="diagram-tools">
          <button type="button" className="btn" disabled={!strokes.length} onClick={() => onChange(strokes.slice(0, -1))}>Undo</button>
          <button type="button" className="btn" disabled={!strokes.length} onClick={() => { if (confirm('Clear all marks?')) onChange([]); }}>Clear all</button>
        </div>
      </div>
      <div className="diagram-board">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CAR_SVG_URL} alt="Car outline: front, left side, top, right side and rear" draggable={false} />
        <canvas
          ref={canvasRef}
          width={DIAGRAM_W * 2}
          height={DIAGRAM_H * 2}
          aria-label="Drawing area for marking damage"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
    </div>
  );
}
