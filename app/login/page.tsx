'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarCheck2, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/components/auth/auth-context';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { error: showError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    if (!email.trim() || !password) {
      setFieldError('Enter your email and password to continue.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      showError('Welcome back', 'Redirecting to the dashboard…');
      router.replace('/dashboard');
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(91,44,111,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(91,44,111,0.12) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 60% 60% at 50% 40%, black, transparent)',
        }}
      />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-white">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">ExamFlow</span>
        </Link>

        <div className="rounded-xl border-[0.5px] border-slate-700 bg-white p-7 shadow-2xl">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Sign in to the console</h1>
          <p className="mt-1 text-[13px] text-slate-500">Access the examination operations dashboard.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {fieldError && (
              <div className="rounded-lg border-[0.5px] border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {fieldError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : null}
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 rounded-lg border-[0.5px] border-purple-200 bg-purple-50 px-3 py-3 text-[12px] leading-relaxed text-purple-800">
            <p className="font-semibold">Demo credentials</p>
            <p className="mt-1 font-mono">admin@examflow.edu.ng / Admin123!</p>
            <p className="font-mono">operator@examflow.edu.ng / Operator123!</p>
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-slate-500">
          <Link href="/" className="hover:text-purple-400">← Back to the landing page</Link>
        </p>
      </div>
    </div>
  );
}
