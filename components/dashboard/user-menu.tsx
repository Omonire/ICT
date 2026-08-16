'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-context';
import { useToast } from '@/components/ui/toast';
import { initials } from '@/lib/format';

export function UserMenu({ user }: { user: { email: string; name: string | null; role: string } }) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const { success } = useToast();
  const router = useRouter();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-100"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-[12px] font-semibold text-white">
          {initials(user.name ?? user.email)}
        </div>
        <div className="hidden text-left sm:block">
          <p className="max-w-[140px] truncate text-[13px] font-medium leading-tight text-slate-800">
            {user.name ?? user.email}
          </p>
          <p className="text-[11px] capitalize leading-tight text-slate-500">{user.role}</p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-48 overflow-hidden rounded-lg border-[0.5px] border-slate-200 bg-white p-1 shadow-card-hover animate-toast-in">
          <div className="border-b-[0.5px] border-slate-100 px-3 py-2">
            <p className="text-[13px] font-medium text-slate-800">{user.name ?? user.email}</p>
            <p className="truncate font-mono text-[11px] text-slate-500">{user.email}</p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              void logout().then(() => {
                success('Signed out', 'Your session has ended.');
                router.replace('/login');
              });
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
