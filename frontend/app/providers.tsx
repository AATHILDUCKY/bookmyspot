'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth';
import { LocationProvider } from '@/lib/location';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <LocationProvider>
          {children}
          <Toaster richColors position='top-right' />
        </LocationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
