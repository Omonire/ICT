'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck2, LayoutDashboard, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#stories', label: 'Stories' },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        scrolled
          ? 'border-b border-slate-100 bg-white/90 backdrop-blur-xl shadow-sm'
          : 'border-b border-transparent'
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-7xl items-center justify-between px-6 transition-all duration-500',
          scrolled ? 'h-14' : 'h-[72px]'
        )}
      >
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-500/10 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-purple-500/20">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <span className="text-[17px] font-bold tracking-tight text-slate-900">
            Exam<span className="text-gold-600">Flow</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-[13px] font-medium text-slate-400 transition-colors duration-200 hover:text-slate-900 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-gold-600 after:transition-all after:duration-300 hover:after:w-full"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-700 transition-all duration-200 hover:text-slate-900 hover:bg-slate-50"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="group inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-4 text-[13px] font-semibold text-slate-950 transition-all duration-300 hover:bg-slate-200 hover:shadow-md"
          >
            <LayoutDashboard className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
            Open console
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all duration-200 hover:bg-slate-50 md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-x-0 top-[72px] bottom-0 z-40 bg-white/95 backdrop-blur-xl md:hidden animate-fade-in-down">
          <nav className="flex flex-col gap-1 px-6 py-6">
            {LINKS.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-4 text-[16px] font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 animate-slide-in-right"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[15px] font-semibold text-slate-950 animate-slide-in-right"
              style={{ animationDelay: '180ms' }}
            >
              <LayoutDashboard className="h-4 w-4" />
              Open console
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
