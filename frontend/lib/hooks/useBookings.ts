'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Booking } from '@/types';

export function useBookings(filter: string) {
  return useQuery({
    queryKey: ['bookings', filter],
    queryFn: async () => (await api.get<Booking[]>('/bookings/me', { params: { filter } })).data,
  });
}
