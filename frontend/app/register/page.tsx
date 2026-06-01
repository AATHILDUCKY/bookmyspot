'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, MapPin, Scissors, Shield, Store, User } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Step = 'info' | 'location' | 'otp';

const PROVINCES = [
  'Western Province',
  'Central Province',
  'Southern Province',
  'Northern Province',
  'Eastern Province',
  'North Western Province',
  'North Central Province',
  'Uva Province',
  'Sabaragamuwa Province',
];

const STEP_LABELS: Record<Step, string> = {
  info: 'Your details',
  location: 'Your location',
  otp: 'Verify email',
};

const STEP_ORDER: Step[] = ['info', 'location', 'otp'];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('info');
  const [role, setRole] = useState<'customer' | 'owner'>('customer');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1 fields (kept in state so they survive navigation between steps)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 fields
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');

  const currentStepIndex = STEP_ORDER.indexOf(step);

  function goToLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStep('location');
  }

  const register = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', {
        name,
        email,
        phone,
        password,
        role,
        city: city || null,
        district: district || null,
        province: province || null,
        address: address || null,
      });
      setStep('otp');
      setMessage('Verification code sent. Check your email.');
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
      setError(msg || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/verify-otp', { email, code: otp });
      setMessage('Account verified! Redirecting to login…');
      setTimeout(() => router.push('/login'), 900);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
      setError(msg || 'Verification failed. Check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 bg-gradient-to-br from-background via-brand-peach/20 to-background'>
      <div className='w-full max-w-md'>
        {/* Header */}
        <div className='text-center mb-8'>
          <div className='inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-ink shadow-lg mb-4'>
            <Scissors size={24} className='text-white' strokeWidth={2} />
          </div>
          <h1 className='text-2xl font-bold text-foreground'>Create your account</h1>
          <p className='mt-1.5 text-sm text-muted-foreground'>Book appointments or grow your salon business</p>
        </div>

        {/* Step progress (hidden on otp step) */}
        {step !== 'otp' && (
          <div className='flex items-center gap-2 mb-6'>
            {(['info', 'location'] as Step[]).map((s, i) => (
              <div key={s} className='flex items-center gap-2 flex-1'>
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                  step === s ? 'bg-brand-ink text-white' :
                  currentStepIndex > i ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                )}>
                  {currentStepIndex > i ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span className={cn('text-xs font-medium', step === s ? 'text-foreground' : 'text-muted-foreground')}>
                  {STEP_LABELS[s]}
                </span>
                {i < 1 && <div className='flex-1 h-px bg-border mx-1' />}
              </div>
            ))}
          </div>
        )}

        {/* Role selector — only on step 1 */}
        {step === 'info' && (
          <div className='grid grid-cols-2 gap-3 mb-6'>
            {([
              { key: 'customer', label: 'Customer', desc: 'Book appointments', icon: User },
              { key: 'owner', label: 'Salon Owner', desc: 'Manage my salon', icon: Store },
            ] as const).map(({ key, label, desc, icon: Icon }) => (
              <button
                key={key}
                type='button'
                onClick={() => setRole(key)}
                className={cn(
                  'rounded-2xl border-2 p-4 text-left transition-all',
                  role === key
                    ? 'border-brand-ink bg-brand-peach/40'
                    : 'border-border bg-white hover:border-brand-sage/50 hover:bg-brand-peach/20',
                )}
              >
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center mb-2', role === key ? 'bg-brand-ink text-white' : 'bg-muted text-muted-foreground')}>
                  <Icon size={18} />
                </div>
                <p className={cn('text-sm font-semibold', role === key ? 'text-brand-ink' : 'text-foreground')}>{label}</p>
                <p className='text-xs text-muted-foreground mt-0.5'>{desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Form card */}
        <div className='rounded-2xl border border-border bg-white shadow-card p-6'>

          {step === 'info' && (
            <form onSubmit={goToLocation} className='space-y-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='name'>Full name</Label>
                <Input id='name' value={name} onChange={(e) => setName(e.target.value)} required placeholder='Your name' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='email'>Email</Label>
                <Input id='email' value={email} onChange={(e) => setEmail(e.target.value)} required type='email' placeholder='you@example.com' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='phone'>Phone</Label>
                <Input id='phone' value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder='+94 77 123 4567' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='password'>Password</Label>
                <Input id='password' value={password} onChange={(e) => setPassword(e.target.value)} required type='password' minLength={6} placeholder='At least 6 characters' />
              </div>

              {error && <div className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{error}</div>}

              <Button type='submit' className='w-full rounded-xl' variant='gradient' size='lg'>
                Next — Location
                <ArrowRight size={16} />
              </Button>
            </form>
          )}

          {step === 'location' && (
            <form onSubmit={register} className='space-y-4'>
              <div className='flex items-center gap-2 mb-1'>
                <MapPin size={16} className='text-brand-sage' />
                <p className='text-sm font-semibold text-foreground'>Where are you based?</p>
              </div>
              <p className='text-xs text-muted-foreground -mt-2'>
                {role === 'owner' ? 'Helps customers find your salon and pre-fills your shop setup.' : 'Helps us show nearby salons to you.'}
              </p>

              <div className='space-y-1.5'>
                <Label htmlFor='province'>Province</Label>
                <select
                  id='province'
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className='w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-sage/40'
                >
                  <option value=''>Select province</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1.5'>
                  <Label htmlFor='district'>District</Label>
                  <Input id='district' value={district} onChange={(e) => setDistrict(e.target.value)} placeholder='e.g. Colombo' />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='city'>City / Town</Label>
                  <Input id='city' value={city} onChange={(e) => setCity(e.target.value)} placeholder='e.g. Nugegoda' />
                </div>
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='address'>Street address</Label>
                <Input id='address' value={address} onChange={(e) => setAddress(e.target.value)} placeholder='No. 12, Main Street' />
              </div>

              {error && <div className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{error}</div>}

              <div className='flex gap-2'>
                <Button type='button' variant='outline' className='rounded-xl flex-1' onClick={() => { setError(''); setStep('info'); }}>
                  Back
                </Button>
                <Button type='submit' disabled={loading} className='rounded-xl flex-[2]' variant='gradient' size='lg'>
                  {loading ? 'Creating account…' : 'Create account'}
                  {!loading && <ArrowRight size={16} />}
                </Button>
              </div>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verify} className='space-y-4'>
              <div className='flex flex-col items-center gap-3 py-4 text-center'>
                <div className='h-14 w-14 rounded-full bg-brand-peach/40 border border-brand-tan/30 flex items-center justify-center'>
                  <Shield size={24} className='text-brand-ink' />
                </div>
                <div>
                  <p className='font-semibold text-foreground'>Verify your email</p>
                  <p className='text-sm text-muted-foreground mt-0.5'>We sent a code to <span className='font-medium text-foreground'>{email}</span></p>
                </div>
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='otp'>Verification code</Label>
                <Input
                  id='otp'
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  placeholder='Enter 6-digit code'
                  className='text-center text-lg tracking-widest font-mono'
                  maxLength={6}
                />
              </div>

              {message && (
                <div className='flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700'>
                  <CheckCircle2 size={16} className='shrink-0' />
                  {message}
                </div>
              )}
              {error && <div className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{error}</div>}

              <Button disabled={loading} className='w-full rounded-xl' variant='gradient' size='lg'>
                {loading ? 'Verifying…' : 'Verify & continue'}
              </Button>

              <button type='button' onClick={() => { setStep('location'); setOtp(''); setMessage(''); setError(''); }} className='w-full text-sm text-muted-foreground hover:text-foreground transition-colors'>
                ← Back
              </button>
            </form>
          )}
        </div>

        <p className='mt-5 text-center text-sm text-muted-foreground'>
          Already have an account?{' '}
          <Link href='/login' className='font-semibold text-brand-sage hover:text-brand-ink transition-colors'>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
