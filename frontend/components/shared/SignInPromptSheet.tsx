'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, CalendarCheck, Heart, LogIn, Sparkles, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

type Intent = 'book' | 'save' | 'report' | 'generic';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent?: Intent;
  // Optional override for the deep-link target (defaults to current path).
  returnTo?: string;
  // Optional context shown in the sheet subtitle, e.g. salon name.
  context?: string;
};

const COPY: Record<Intent, { title: string; sub: string; icon: typeof LogIn; accent: string }> = {
  book: {
    title: 'Sign in to book',
    sub: 'Create an account or sign in to confirm your appointment.',
    icon: CalendarCheck,
    accent: 'from-brand-sage to-emerald-600',
  },
  save: {
    title: 'Sign in to save',
    sub: 'Save your favourite salons so you can find them later.',
    icon: Heart,
    accent: 'from-rose-500 to-pink-600',
  },
  report: {
    title: 'Sign in to report',
    sub: 'Reports are kept confidential and tied to your account.',
    icon: Sparkles,
    accent: 'from-amber-500 to-rose-500',
  },
  generic: {
    title: 'Sign in to continue',
    sub: 'Sign in or create a free account to use this feature.',
    icon: LogIn,
    accent: 'from-brand-ink to-[#2a2724]',
  },
};

export function SignInPromptSheet({ open, onOpenChange, intent = 'generic', returnTo, context }: Props) {
  const pathname = usePathname();
  const next = encodeURIComponent(returnTo || pathname || '/');
  const copy = COPY[intent];
  const Icon = copy.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='bottom' className='rounded-t-3xl p-0 max-h-[90vh] overflow-y-auto'>
        <div className='relative px-6 pt-7 pb-6'>
          {/* Close pill */}
          <button
            onClick={() => onOpenChange(false)}
            className='absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted'
            aria-label='Close'
          >
            <X size={16} />
          </button>

          {/* Hero icon with accent */}
          <div className={`mx-auto h-16 w-16 rounded-3xl bg-gradient-to-br ${copy.accent} shadow-md flex items-center justify-center mb-4`}>
            <Icon size={28} className='text-white' strokeWidth={2} />
          </div>

          <h2 className='text-center text-xl font-bold text-foreground'>{copy.title}</h2>
          <p className='mt-1.5 text-center text-sm text-muted-foreground max-w-xs mx-auto'>
            {copy.sub}
          </p>
          {context && (
            <p className='mt-3 text-center text-xs font-semibold text-brand-ink bg-brand-peach/40 rounded-full px-3 py-1.5 mx-auto w-fit'>
              {context}
            </p>
          )}

          {/* Benefits — short, scannable */}
          <ul className='mt-5 space-y-2 text-sm text-foreground'>
            <Benefit>Book in seconds with saved details</Benefit>
            <Benefit>Track upcoming and past visits</Benefit>
            <Benefit>Save favourite salons & follow updates</Benefit>
          </ul>

          {/* Actions */}
          <div className='mt-6 space-y-2'>
            <Link href={`/login?next=${next}`} className='block'>
              <Button variant='gradient' className='w-full rounded-xl h-12 text-base'>
                <LogIn size={16} />
                Sign in
                <ArrowRight size={16} className='ml-auto' />
              </Button>
            </Link>
            <Link href='/register' className='block'>
              <Button variant='outline' className='w-full rounded-xl h-12 text-base'>
                Create a free account
              </Button>
            </Link>
          </div>

          <button
            onClick={() => onOpenChange(false)}
            className='mt-4 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground'
          >
            Maybe later — keep browsing
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Benefit({ children }: { children: React.ReactNode }) {
  return (
    <li className='flex items-start gap-2.5'>
      <span className='mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-sage shrink-0' />
      <span>{children}</span>
    </li>
  );
}
