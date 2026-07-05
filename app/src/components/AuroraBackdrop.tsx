/** AuroraBackdrop — the living background field for the working views. Not a
 *  panel: a full-bleed ambient layer the content sits on top of, weighted to the
 *  right and masked out under the left-side form (see .view-backdrop). Built
 *  ONLY from brand hues and re-skins with the theme; freezes to one calm frame
 *  under prefers-reduced-motion (§6).
 *
 *  Two distinct behaviours:
 *   · "assert"  — a source node throws two diverging energy streams (the Fork
 *                 forming) with warm rising motes. Active, creative.
 *   · "explorer"— cool scan beams sweep a settled field while motes converge on
 *                 a resolved core. Calm, finalized. */

import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../design/motion';

type Variant = 'assert' | 'explorer' | 'both';
type Rgb = [number, number, number];

function readRgb(cs: CSSStyleDeclaration, token: string, fallback: Rgb): Rgb {
  const hex = cs.getPropertyValue(token).trim().replace('#', '');
  if (hex.length < 6) return fallback;
  const n = parseInt(hex.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

type Palette = {
  a: Rgb; b: Rgb; signal: Rgb; gold: Rgb; fog: Rgb; dark: boolean;
};

function samplePalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  return {
    a: readRgb(cs, '--claim-a', [224, 137, 74]),
    b: readRgb(cs, '--claim-b', [79, 176, 201]),
    signal: readRgb(cs, '--signal', [91, 139, 240]),
    gold: readRgb(cs, '--unresolved', [203, 162, 85]),
    fog: readRgb(cs, '--field', [14, 17, 22]),
    dark: (document.documentElement.dataset.theme ?? 'dark') !== 'light',
  };
}

const rgba = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

type Mote = { x: number; y: number; vx: number; vy: number; r: number; c: Rgb; ph: number };

export function AuroraBackdrop({
  variant,
  className = '',
}: {
  variant: Variant;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let pal = samplePalette();
    let W = 0, H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = prefersReducedMotion();

    // 'both' shares assert's geometry (source high-right, rising motes) and adds
    // explorer's scan beams on top — one canvas carrying both signatures.
    const isExplorer = variant === 'explorer';

    let s = (isExplorer ? 3 : 7) * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

    // The energy source / focus point, anchored to the strong (right) side.
    const focus = () => (isExplorer
      ? { x: W * 0.70, y: H * 0.5 }     // resolved core, mid-right
      : { x: W * 0.72, y: H * 0.22 });  // source high-right, streams fall away

    let motes: Mote[] = [];
    const seedMotes = () => {
      const hues: Rgb[] = isExplorer
        ? [pal.signal, pal.gold, pal.b]
        : [pal.a, pal.b, pal.signal, pal.gold];
      const count = Math.max(16, Math.round((W * H) / 30000));
      motes = Array.from({ length: count }, () => ({
        x: rnd() * W, y: rnd() * H,
        vx: (rnd() - 0.5) * 0.15,
        vy: isExplorer ? (rnd() - 0.5) * 0.1 : -0.12 - rnd() * 0.25,
        r: 1 + rnd() * 2.4,
        c: hues[Math.floor(rnd() * hues.length)],
        ph: rnd() * Math.PI * 2,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedMotes();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Ambient aurora blobs — palette weighted per variant.
    const blobs = !isExplorer
      ? [
          { c: () => pal.a, cx: 0.62, cy: 0.30, sp: 0.00023, ph: 0.0, rad: 0.55 },
          { c: () => pal.b, cx: 0.80, cy: 0.68, sp: 0.00019, ph: 2.1, rad: 0.55 },
          { c: () => pal.signal, cx: 0.72, cy: 0.46, sp: 0.00031, ph: 4.0, rad: 0.42 },
          { c: () => pal.gold, cx: 0.55, cy: 0.80, sp: 0.00027, ph: 5.4, rad: 0.34 },
        ]
      : [
          { c: () => pal.signal, cx: 0.70, cy: 0.46, sp: 0.00016, ph: 0.0, rad: 0.6 },
          { c: () => pal.gold, cx: 0.82, cy: 0.62, sp: 0.00013, ph: 2.6, rad: 0.44 },
          { c: () => pal.b, cx: 0.58, cy: 0.34, sp: 0.00018, ph: 4.4, rad: 0.4 },
        ];

    /** ASSERT: a diverging energy stream from the source, flowing dashes. */
    const stream = (t: number, dir: 1 | -1, c: Rgb) => {
      const f = focus();
      ctx.beginPath();
      for (let i = 0; i <= 26; i++) {
        const p = i / 26;
        const y = f.y + p * (H - f.y);
        const spread = Math.sin(p * Math.PI * 0.5) * W * 0.26;
        const sway = Math.sin(p * 3 + t * 0.001 * dir) * spread * 0.28;
        const x = f.x + dir * spread + sway;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const g = ctx.createLinearGradient(0, f.y, 0, H);
      g.addColorStop(0, rgba(c, pal.dark ? 0.6 : 0.42));
      g.addColorStop(1, rgba(c, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.setLineDash([2, 10]);
      ctx.lineDashOffset = -t * 0.05 * dir;
      ctx.stroke();
      ctx.setLineDash([]);
    };

    /** EXPLORER: horizontal scan beams sweeping down — a settled read-out. */
    const scan = (t: number) => {
      const bands = 3;
      for (let k = 0; k < bands; k++) {
        const phase = ((t * 0.00008) + k / bands) % 1;
        const y = phase * H;
        const c = k % 2 ? pal.signal : pal.gold;
        const g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(0.5, rgba(c, pal.dark ? 0.18 : 0.12));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 40, W, 80);
      }
    };

    let raf = 0;
    const draw = (t: number) => {
      const time = reduced ? 9000 : t;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgba(pal.fog, 1);
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = pal.dark ? 'lighter' : 'source-over';
      for (const bl of blobs) {
        const bt = time * bl.sp + bl.ph;
        const cx = (bl.cx + Math.cos(bt) * 0.08) * W;
        const cy = (bl.cy + Math.sin(bt * 1.3) * 0.08) * H;
        const breath = 0.85 + Math.sin(bt * 1.6) * 0.15;
        const r = Math.max(W, H) * bl.rad * 0.7 * breath;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, rgba(bl.c(), pal.dark ? 0.42 : 0.24));
        g.addColorStop(1, rgba(bl.c(), 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // 'assert' + 'both' draw the diverging streams; 'explorer' + 'both' the scan.
      if (variant !== 'explorer') {
        stream(time, 1, pal.a);
        stream(time, -1, pal.b);
      }
      if (variant !== 'assert') {
        scan(time);
      }

      const f = focus();
      for (const m of motes) {
        if (!reduced) {
          if (!isExplorer) {
            m.x += m.vx; m.y += m.vy;
            if (m.y < -6) { m.y = H + 6; m.x = rnd() * W; }
          } else {
            // drift toward the resolved core, then respawn at the edge
            m.x += (f.x - m.x) * 0.0025 + m.vx;
            m.y += (f.y - m.y) * 0.0025 + m.vy;
            if (Math.hypot(m.x - f.x, m.y - f.y) < 12) {
              m.x = rnd() * W; m.y = rnd() * H;
            }
          }
          if (m.x < -6) m.x = W + 6;
          if (m.x > W + 6) m.x = -6;
        }
        const tw = 0.55 + Math.sin(time * 0.002 + m.ph) * 0.45;
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
        g.addColorStop(0, rgba(m.c, (pal.dark ? 0.85 : 0.55) * tw));
        g.addColorStop(1, rgba(m.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Focus core — a source (assert) or a resolved node (explorer).
      const pulse = 0.7 + Math.sin(time * 0.0022) * 0.3;
      const coreR = Math.min(W, H) * (isExplorer ? 0.09 : 0.07) * pulse;
      const coreC = isExplorer ? pal.gold : pal.signal;
      const cg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, coreR * 3.5);
      cg.addColorStop(0, rgba(coreC, pal.dark ? 0.8 : 0.45));
      cg.addColorStop(0.4, rgba(coreC, pal.dark ? 0.22 : 0.12));
      cg.addColorStop(1, rgba(coreC, 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(f.x, f.y, coreR * 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const mo = new MutationObserver(() => {
      pal = samplePalette();
      seedMotes();
      if (reduced) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, [variant]);

  return (
    <div className={`view-backdrop ${className}`.trim()} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
