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
}

const COLS = 16;
const ROWS = 10;
const TOTAL_SEATS = COLS * ROWS;

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, p: number): void {
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

  const seats: Seat[] = [];
  let idx = 0;
  for (let row = 0; row < ROWS; row++) {
    const z = row / (ROWS - 1);
    const scale = 1 - z * 0.78;
    const y = frontY + (backY - frontY) * z;
    const rowUnit = unit * scale;
    for (let col = 0; col < COLS; col++) {
      const x = cx + (col - (COLS - 1) / 2) * rowUnit;
      seats.push({ x, y, r: rowUnit * 0.3, threshold: fillStart + (idx / seatCount) * (fillEnd - fillStart) });
      idx++;
    }
  }

  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.55, '#0b1220');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

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

  ctx.lineWidth = 1;
  for (const s of seats) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const filled = seats.filter((s) => p >= s.threshold);
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

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export default function ScrollVideo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const seatRef = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    const clip = clipRef.current;
    if (!canvas || !section || !clip) return;

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

    let canvasP = 0;
    const render = () => {
      raf.current = 0;
      drawScene(ctx, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1), canvasP);
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
        const p = self.progress;

        // Clip-path opening acts like a frame settling into the viewport
        const open = clamp(p / 0.12, 0, 1);
        const inset = 24 * (1 - open);
        const side = 14 * (1 - open);
        clip.style.clipPath = `inset(${inset}% ${side}% ${inset}% ${side}% round ${26 * (1 - open)}px)`;

        // The seats fill after the frame has opened
        canvasP = clamp((p - 0.12) / 0.62, 0, 1);
        const fillT = clamp((canvasP - 0.12) / 0.38, 0, 1);
        if (seatRef.current) {
          seatRef.current.textContent = String(Math.round(fillT * TOTAL_SEATS)).padStart(3, '0');
        }
        if (pctRef.current) {
          pctRef.current.textContent = String(Math.round(canvasP * 100)).padStart(3, '0');
        }
        if (captionRef.current) {
          const c = clamp((p - 0.78) / 0.12, 0, 1);
          captionRef.current.style.opacity = String(c);
          captionRef.current.style.transform = `translateY(${(1 - c) * 16}px)`;
        }
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
    <section ref={sectionRef} className="relative h-[420vh] bg-slate-950">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div ref={clipRef} className="absolute inset-0" style={{ clipPath: 'inset(24% 14% 24% 14% round 26px)' }}>
          <canvas ref={canvasRef} className="block h-full w-full" />
        </div>

        <div className="pointer-events-none absolute left-6 top-6 font-mono md:left-10 md:top-10">
          <p className="text-[10px] tracking-[0.3em] text-slate-500 uppercase">live render</p>
          <p className="mt-1 text-3xl font-bold text-white md:text-5xl">
            <span ref={seatRef}>000</span>
            <span className="text-gold-300">/{TOTAL_SEATS}</span>
          </p>
          <p className="mt-1 text-[10px] tracking-[0.25em] text-slate-500 uppercase">candidates seated</p>
        </div>

        <div className="pointer-events-none absolute right-6 top-6 font-mono text-right md:right-10 md:top-10">
          <p className="text-4xl font-bold text-white md:text-6xl">
            <span ref={pctRef}>000</span>
            <span className="text-gold-300">%</span>
          </p>
          <p className="mt-1 text-[10px] tracking-[0.25em] text-slate-500 uppercase">seats assigned</p>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-6 text-center">
          <div className="max-w-2xl">
            <span className="font-mono text-[11px] tracking-[0.3em] text-gold-300 uppercase">
              The engine, on screen
            </span>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
              Thousands of candidates.
              <br />
              <span className="text-gold-300">Zero collisions.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-slate-400 md:text-[15px]">
              Scroll to watch the scheduling engine seat every candidate into a
              unique hall, session and seat.
            </p>
          </div>
        </div>

        <div
          ref={captionRef}
          className="pointer-events-none absolute inset-x-0 bottom-10 flex items-center justify-center px-6 opacity-0"
        >
          <p className="flex items-center gap-3 rounded-full border border-gold-300/20 bg-gold-400/10 px-5 py-2.5 font-mono text-[10.5px] tracking-[0.25em] text-gold-200 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />
            Schedule complete · 0 conflicts · print the sheets
          </p>
        </div>
      </div>
    </section>
  );
}
