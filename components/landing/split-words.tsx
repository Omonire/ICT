'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cn } from '@/lib/utils';

gsap.registerPlugin(ScrollTrigger);

type SplitWordsProps = {
  text: string;
  /** Indices of words that should render in the accent style. */
  accents?: number[];
  className?: string;
  start?: string;
  once?: boolean;
};

/** Splits a string into word spans and reveals them with a masked rise on scroll. */
export default function SplitWords({
  text,
  accents = [],
  className,
  start = 'top 86%',
  once = true,
}: SplitWordsProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = el.querySelectorAll<HTMLElement>('[data-w]');
    const tl = gsap.fromTo(
      words,
      { yPercent: 115, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.85,
        stagger: 0.045,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start, once },
      }
    );
    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [start, once]);

  return (
    <span ref={ref} className={cn('inline', className)} aria-label={text}>
      {text.split(' ').map((word, i) => (
        <span
          key={i}
          className="inline-block overflow-hidden pb-[0.14em] -mb-[0.14em] align-bottom"
          aria-hidden
        >
          <span
            data-w
            className={cn(
              'inline-block will-change-transform',
              accents.includes(i) && 'text-gold-300'
            )}
          >
            {word}&nbsp;
          </span>
        </span>
      ))}
    </span>
  );
}
