'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function LandingReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
    const batch = ScrollTrigger.batch(targets, {
      start: 'top 85%',
      once: true,
      onEnter: (batchEls) => {
        gsap.to(batchEls, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: 'power3.out',
          overwrite: true,
        });
      },
    });
    return () => {
      batch.forEach((t) => t.kill());
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
