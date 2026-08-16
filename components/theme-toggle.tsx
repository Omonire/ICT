'use client';

import { Moon, Sun, Palette } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

const THEMES = [
  { key: 'light' as const, icon: Sun, label: 'Light' },
  { key: 'dark' as const, icon: Moon, label: 'Dark' },
  { key: 'purple' as const, icon: Palette, label: 'Purple' },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn('flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1', className)}>
      {THEMES.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md transition-all',
            theme === key
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          )}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
