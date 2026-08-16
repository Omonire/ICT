'use client';

import { ReactNode } from 'react';
import { useInView } from '@/hooks/use-in-view';
import { cn } from '@/lib/utils';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale';
}

export function Reveal({ children, className, delay = 0, direction = 'up' }: RevealProps) {
  const { ref, inView } = useInView();

  const directionClass = {
    up: 'animate-fade-in-up',
    down: 'animate-fade-in-down',
    left: 'animate-slide-in-left',
    right: 'animate-slide-in-right',
    scale: 'animate-scale-in',
  }[direction];

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700',
        inView
          ? cn(directionClass, className)
          : 'opacity-0 translate-y-6'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
