'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowRight, CalendarCheck, Heart, Lock, Mail, Scissors, Search, Sparkles, Zap } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function dashboardFor(role: string) {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'owner') return '/owner/dashboard';
  return '/';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(email.trim(), password);
      const dest = nextParam && nextParam.startsWith('/') ? nextParam : dashboardFor(user.role);
      router.push(dest);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
      setError(msg || 'Login failed. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-[calc(100vh-4rem)] flex'>
      {/* Left panel — dark ink */}
      <div className='hidden lg:flex flex-col justify-between w-1/2 bg-brand-ink p-12 relative overflow-hidden'>
        <div className='pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-brand-peach/6 blur-3xl' />
        <div className='pointer-events-none absolute bottom-10 left-10 h-64 w-64 rounded-full bg-brand-tan/6 blur-2xl' />

        <div className='relative flex items-center gap-3'>
          <div className='h-9 w-9 flex items-center justify-center rounded-xl bg-white/10'>
            <Scissors size={17} className='text-white' strokeWidth={2.5} />
          </div>
          <span className='text-white font-bold text-lg'><span className='text-brand-sage'>book</span>myspot</span>
        </div>

        <div className='relative'>
          <h2 className='text-3xl font-bold text-white leading-snug'>
            Manage your salon.<br />
            <span className='text-white/40'>Effortlessly.</span>
          </h2>
          <p className='mt-3 text-white/40 text-sm'>
            One platform for customers to book and salon owners to manage everything.
          </p>
          <div className='mt-8 grid grid-cols-2 gap-3'>
            {[
              { value: '500+', label: 'Shops' },
              { value: '10k+', label: 'Bookings' },
              { value: '4.8★', label: 'Avg rating' },
              { value: '50+', label: 'Cities' },
            ].map(({ value, label }) => (
              <div key={label} className='rounded-2xl bg-white/6 border border-white/8 p-4'>
                <p className='text-2xl font-bold text-white'>{value}</p>
                <p className='text-xs text-white/40'>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className='relative text-xs text-white/25'>© 2026 bookmyspot. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className='flex flex-1 flex-col items-stretch lg:items-center lg:justify-center px-4 py-6 lg:py-10 bg-background'>
        {/* ── Mobile hero (replaces the empty space above the form on phones) ── */}
        <div className='lg:hidden relative overflow-hidden rounded-3xl mb-6 bg-gradient-to-br from-brand-ink via-[#2a2724] to-brand-ink text-white p-5'>
          <div className='absolute -top-10 -right-10 h-36 w-36 rounded-full bg-brand-peach/15 blur-3xl' />
          <div className='absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-brand-sage/20 blur-3xl' />
          <div className='relative flex items-center gap-2.5'>
            <div className='h-10 w-10 flex items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm'>
              <Scissors size={17} className='text-white' strokeWidth={2.5} />
            </div>
            <span className='font-bold text-lg'>
              <span className='text-brand-sage'>book</span>myspot
            </span>
          </div>
          <h1 className='relative mt-4 text-2xl font-bold leading-tight'>
            Welcome back.<br />
            <span className='text-white/60'>Your spot is waiting.</span>
          </h1>
          <div className='relative mt-4 grid grid-cols-3 gap-2'>
            {[
              { icon: CalendarCheck, label: 'Book fast' },
              { icon: Heart, label: 'Save salons' },
              { icon: Zap, label: 'Track visits' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className='rounded-xl bg-white/8 border border-white/10 px-2 py-2 flex flex-col items-center gap-1'>
                <Icon size={14} className='text-brand-sage' />
                <span className='text-[10px] font-medium text-white/70'>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className='w-full max-w-sm mx-auto'>
          <div className='mb-6 hidden lg:block'>
            <h1 className='text-2xl font-bold text-foreground'>Welcome back</h1>
            <p className='mt-1.5 text-sm text-muted-foreground'>Sign in to your account</p>
          </div>
          <div className='mb-5 lg:hidden'>
            <h2 className='text-lg font-bold text-foreground'>Sign in to your account</h2>
            <p className='mt-0.5 text-xs text-muted-foreground'>
              {nextParam ? "You'll come right back here after signing in." : 'Pick up where you left off.'}
            </p>
          </div>

          <form onSubmit={onSubmit} className='space-y-4'>
            <div className='space-y-1.5'>
              <Label htmlFor='email'>Email</Label>
              <div className='relative'>
                <Mail size={16} className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
                <Input
                  id='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type='email'
                  autoComplete='email'
                  required
                  className='pl-9'
                  placeholder='you@example.com'
                />
              </div>
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='password'>Password</Label>
              <div className='relative'>
                <Lock size={16} className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
                <Input
                  id='password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type='password'
                  autoComplete='current-password'
                  required
                  className='pl-9'
                  placeholder='Enter your password'
                />
              </div>
            </div>

            {error && (
              <div className='flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
                <AlertCircle size={16} className='mt-0.5 shrink-0' />
                <p>{error}</p>
              </div>
            )}

            <Button disabled={loading} className='w-full rounded-xl' variant='gradient' size='lg'>
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight size={16} />}
            </Button>
          </form>

          <p className='mt-6 text-center text-sm text-muted-foreground'>
            New to bookmyspot?{' '}
            <Link href='/register' className='font-semibold text-brand-sage hover:text-brand-ink transition-colors'>
              Create account
            </Link>
          </p>

          {/* Browse-without-login exit */}
          <div className='mt-5 lg:hidden'>
            <div className='relative flex items-center gap-3'>
              <div className='flex-1 h-px bg-border' />
              <span className='text-[11px] uppercase tracking-wider text-muted-foreground'>or</span>
              <div className='flex-1 h-px bg-border' />
            </div>
            <Link
              href='/shops'
              className='mt-4 flex items-center justify-between gap-2 rounded-2xl border border-border bg-white px-4 py-3 hover:bg-muted/40 active:scale-[0.99] transition'
            >
              <span className='flex items-center gap-2.5 text-sm font-semibold text-foreground'>
                <Search size={16} className='text-brand-sage' />
                Browse shops without signing in
              </span>
              <ArrowRight size={15} className='text-muted-foreground' />
            </Link>
            <p className='mt-3 text-center text-[11px] text-muted-foreground'>
              <Sparkles size={11} className='inline -mt-0.5 mr-1 text-brand-sage' />
              Search and explore freely. Sign in only when you book.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
