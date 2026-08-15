'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface Seat {
  x: number;
  y: number;
  r: number;
  threshold: number;
  label: number;
}

const COLS = 16;
const ROWS = 10;

function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number
): void {
  ctx.clearRect(0, 0, w, h);

  const seatCount = COLS * ROWS;
  const fillStart = 0.12;
  const fillEnd = 0.5;
  const sweepStart = 0.52;
  const sweepEnd = 0.8;

  const cx = w / 2;
  const frontY = h * 0.82;
  const backY = h * 0.2;
  const unit = Math.min(w / COLS, h / ROWS) * 0.62;

  // Seats (perspective grid: back rows are smaller and closer to vanishing line)
  const seats: Seat[] = [];
  let idx = 0;
  for (let row = 0; row < ROWS; row++) {
    const z = row / (ROWS - 1);
    const scale = 1 - z * 0.78;
    const y = frontY + (backY - frontY) * z;
    const rowUnit = unit * scale;
    for (let col = 0; col < COLS; col++) {
      const x = cx + (col - (COLS - 1) / 2) * rowUnit;
      seats.push({
        x,
        y,
        r: rowUnit * 0.3,
        threshold: fillStart + (idx / seatCount) * (fillEnd - fillStart),
        label: idx + 1,
      });
      idx++;
    }
  }

  // Backdrop glow
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.55, '#0b1220');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Guide lines converging to the vanishing point
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
  ctx.lineWidth = 1;
  const vpY = backY - (frontY - backY) * 0.9;
  ctx.beginPath();
  for (let col = 0; col <= COLS; col += 2) {
    const z = 0.4;
    const scale = 1 - z * 0.78;
    const x = cx + (col - COLS / 2) * unit * scale;
    const y = frontY + (backY - frontY) * z;
    ctx.moveTo(x, y);
    ctx.lineTo(cx, vpY);
  }
  ctx.stroke();

  // Empty grid first
  ctx.lineWidth = 1;
  for (const s of seats) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Filled seats appear as we scroll
  const filled = seats.filter((s) => p >= s.threshold);
  const fillT = p < fillStart ? 0 : Math.min(1, (p - fillStart) / (fillEnd - fillStart));
  for (const s of filled) {
    const fade = Math.min(1, (p - s.threshold) / 0.02);
    ctx.fillStyle = `rgba(13, 148, 136, ${0.75 * fade})`;
    ctx.strokeStyle = `rgba(45, 212, 191, ${0.9 * fade})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Seated-candidate count, frame-by-frame like a real render
  if (fillT > 0) {
    const seated = Math.round(fillT * seatCount);
    ctx.font = `600 ${Math.round(w * 0.03)}px var(--font-plex), monospace`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(45, 212, 191, 0.9)';
    ctx.fillText(String(seated).padStart(4, '0'), w - 24, 44);
    ctx.font = '500 12px var(--font-inter), sans-serif';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.fillText('CANDIDATES SEATED', w - 24, 60);
  }

  // Sweep line after filling completes
  if (p > sweepStart && p < sweepEnd) {
    const t = (p - sweepStart) / (sweepEnd - sweepStart);
    const y = backY + (frontY - backY) * t;
    const grad = ctx.createLinearGradient(0, y - 40, 0, y + 40);
    grad.addColorStop(0, 'rgba(13,148,136,0)');
    grad.addColorStop(0.5, 'rgba(45,212,191,0.55)');
    grad.addColorStop(1, 'rgba(13,148,136,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 40, w, 80);
    ctx.fillStyle = 'rgba(94, 234, 212, 0.9)';
    ctx.fillRect(0, y - 1, w, 2);
  }

  // Completion state
  if (p >= sweepEnd) {
    const k = Math.min(1, (p - sweepEnd) / 0.12);
    ctx.strokeStyle = `rgba(52, 211, 153, ${0.7 * k})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, h * 0.5, Math.max(w, h) * 0.42 * (0.85 + k * 0.15), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(52, 211, 153, ${0.85 * k})`;
    ctx.font = `700 ${Math.round(w * 0.024)}px var(--font-inter), sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SCHEDULE COMPLETE', cx, h * 0.5 + 8);
  }
}

export default function ScrollVideo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = section.clientWidth * dpr;
      canvas.height = section.clientHeight * dpr;
      canvas.style.width = `${section.clientWidth}px`;
      canvas.style.height = `${section.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let progress = 0;
    const render = () => {
      raf.current = 0;
      drawScene(ctx, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1), progress);
    };
    const scheduleRender = () => {
      if (!raf.current) raf.current = requestAnimationFrame(render);
    };

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        progress = self.progress;
        scheduleRender();
      },
    });

    const onResize = () => {
      resize();
      scheduleRender();
    };
    window.addEventListener('resize', onResize);

    scheduleRender();

    return () => {
      st.kill();
      window.removeEventListener('resize', onResize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative h-[340vh] bg-slate-950">
      <div className="sticky top-0 h-screen overflow-hidden">
        <canvas ref={canvasRef} className="block h-full w-full" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="font-mono text-[11px] tracking-[0.3em] text-brand-300 uppercase">
            Live demonstration
          </span>
          <p className="max-w-2xl text-2xl font-semibold leading-tight text-white md:text-4xl">
            Thousands of candidates.
            <br />
            <span className="text-brand-400">Zero collisions.</span>
          </p>
          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Scroll to watch the scheduling engine seat every candidate into a unique
            hall, session and seat — in seconds.
          </p>
        </div>
      </div>
    </section>
  );
}
