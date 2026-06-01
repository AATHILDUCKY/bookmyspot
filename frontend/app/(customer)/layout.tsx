'use client';

import { ReactNode } from 'react';
import { RequireAuth } from '@/components/shared/RequireAuth';

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
