'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useOwnerDashboard() {
  return useQuery({
    queryKey: ['owner-analytics'],
    queryFn: async () => (await api.get('/owner/analytics')).data,
  });
}
