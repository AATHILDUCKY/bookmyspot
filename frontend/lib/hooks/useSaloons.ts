'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Saloon } from '@/types';

export function useSaloons(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ['saloons', params],
    queryFn: async () => (await api.get<Saloon[]>('/saloons', { params })).data,
  });
}
