// Original car outline for marking damage: front at the top, rear at the bottom,
// top view in the middle and the left and right sides on either side.
// Drawn on a 600 x 900 grid; the marking canvas uses the same grid.

export const DIAGRAM_W = 600;
export const DIAGRAM_H = 900;

const side = (mirror: boolean) => {
  const g = (inner: string) => (mirror ? `<g transform="translate(600,0) scale(-1,1)">${inner}</g>` : `<g>${inner}</g>`);
  return g(`
    <path d="M58 182 Q46 186 46 205 L46 695 Q46 714 58 718 L112 722 Q122 722 124 712 L124 188 Q122 178 112 178 Z"/>
    <path d="M124 300 L150 352 L152 560 L124 612"/>
    <path d="M128 312 L146 356 L146 446 L128 446 Z"/>
    <path d="M128 456 L146 456 L146 556 L128 600 Z"/>
    <line x1="124" y1="451" x2="70" y2="451"/>
    <line x1="124" y1="330" x2="58" y2="330"/>
    <line x1="124" y1="580" x2="58" y2="580"/>
    <rect x="112" y="290" width="16" height="22" rx="5"/>
    <circle cx="66" cy="252" r="40" fill="#fff"/><circle cx="66" cy="252" r="24"/>
    <circle cx="66" cy="648" r="40" fill="#fff"/><circle cx="66" cy="648" r="24"/>
    <rect x="50" y="190" width="10" height="26" rx="4"/>
    <rect x="50" y="684" width="10" height="26" rx="4"/>
  `);
};

export const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DIAGRAM_W} ${DIAGRAM_H}" width="${DIAGRAM_W}" height="${DIAGRAM_H}">
<rect width="600" height="900" fill="#ffffff"/>
<g fill="none" stroke="#2b333b" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">
  <!-- Front view -->
  <path d="M232 70 L256 28 Q300 22 344 28 L368 70"/>
  <path d="M244 66 L262 36 Q300 31 338 36 L356 66 Z"/>
  <rect x="200" y="70" width="200" height="56" rx="14"/>
  <rect x="210" y="80" width="40" height="16" rx="5"/>
  <rect x="350" y="80" width="40" height="16" rx="5"/>
  <rect x="268" y="92" width="64" height="20" rx="4"/>
  <rect x="206" y="126" width="30" height="16" rx="4"/>
  <rect x="364" y="126" width="30" height="16" rx="4"/>
  <rect x="190" y="52" width="14" height="20" rx="4"/>
  <rect x="396" y="52" width="14" height="20" rx="4"/>

  <!-- Top view -->
  <path d="M260 168 Q300 160 340 168 Q392 178 396 236 L398 670 Q394 724 340 732 Q300 738 260 732 Q206 724 202 670 L204 236 Q208 178 260 168 Z"/>
  <path d="M212 300 Q300 284 388 300"/>
  <path d="M226 336 Q300 316 374 336 L366 380 Q300 368 234 380 Z"/>
  <path d="M234 380 L234 560 M366 380 L366 560"/>
  <path d="M234 560 Q300 572 366 560 L374 612 Q300 628 226 612 Z"/>
  <path d="M212 648 Q300 664 388 648"/>
  <rect x="186" y="340" width="16" height="22" rx="5"/>
  <rect x="398" y="340" width="16" height="22" rx="5"/>
  <line x1="204" y1="452" x2="234" y2="452"/><line x1="366" y1="452" x2="396" y2="452"/>
  <rect x="194" y="226" width="10" height="56" rx="4"/>
  <rect x="396" y="226" width="10" height="56" rx="4"/>
  <rect x="194" y="618" width="10" height="56" rx="4"/>
  <rect x="396" y="618" width="10" height="56" rx="4"/>

  <!-- Left and right sides -->
  ${side(false)}
  ${side(true)}

  <!-- Rear view -->
  <rect x="200" y="768" width="200" height="56" rx="14"/>
  <path d="M232 824 L256 866 Q300 872 344 866 L368 824"/>
  <path d="M244 828 L262 858 Q300 863 338 858 L356 828 Z"/>
  <rect x="210" y="784" width="40" height="16" rx="5"/>
  <rect x="350" y="784" width="40" height="16" rx="5"/>
  <rect x="272" y="790" width="56" height="18" rx="3"/>
  <rect x="206" y="752" width="30" height="16" rx="4"/>
  <rect x="364" y="752" width="30" height="16" rx="4"/>
</g>
<g fill="#7a8591" font-family="Arial, sans-serif" font-size="15" text-anchor="middle">
  <text x="300" y="16">FRONT</text>
  <text x="300" y="894">REAR</text>
  <text x="18" y="455" transform="rotate(-90 18 455)">LEFT</text>
  <text x="582" y="455" transform="rotate(90 582 455)">RIGHT</text>
</g>
</svg>`;

export const CAR_SVG_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(CAR_SVG)}`;

export type Stroke = { x: number; y: number }[];

export const MARK_COLOR = '#e10600';
export const MARK_WIDTH = 7;

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.strokeStyle = MARK_COLOR;
  ctx.fillStyle = MARK_COLOR;
  ctx.lineWidth = MARK_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (!s.length) continue;
    if (s.length === 1) {
      ctx.beginPath(); ctx.arc(s[0].x, s[0].y, MARK_WIDTH, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
    ctx.stroke();
  }
}

// Draws the outline with the red marks into a JPEG for saving with the inspection.
export async function renderDiagram(strokes: Stroke[], scale = 2): Promise<{ blob: Blob; w: number; h: number }> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = CAR_SVG_URL;
  });
  const c = document.createElement('canvas');
  c.width = DIAGRAM_W * scale; c.height = DIAGRAM_H * scale;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.scale(scale, scale);
  drawStrokes(ctx, strokes);
  const blob = await new Promise<Blob>((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('blob'))), 'image/jpeg', 0.88));
  return { blob, w: c.width, h: c.height };
}
