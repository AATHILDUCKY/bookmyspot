'use client';

import { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { RequireAuth } from '@/components/shared/RequireAuth';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth roles={['admin']}>
      <div className='flex w-full'>
        <AdminSidebar />
        <main className='flex-1 min-w-0'>
          {children}
        </main>
      </div>
    </RequireAuth>
  );
}
