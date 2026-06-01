'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type Props = {
  children: ReactNode;
  // Optionally restrict to certain roles (e.g. ['customer']). If unset, any logged-in user passes.
  roles?: Array<'customer' | 'owner' | 'admin'>;
};

export function RequireAuth({ children, roles }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`/login?next=${next}`);
      return;
    }
    if (roles && !roles.includes(user.role as any)) {
      router.replace('/');
    }
  }, [loading, user, roles, router, pathname]);

  if (loading || !user || (roles && !roles.includes(user.role as any))) {
    return (
      <div className='mx-auto max-w-md px-4 py-16 flex flex-col items-center text-muted-foreground'>
        <Loader2 size={22} className='animate-spin mb-2' />
        <p className='text-sm'>Checking your session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
