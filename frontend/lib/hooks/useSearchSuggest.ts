'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ShopSuggestion { id: number; name: string; city: string }
export interface CategorySuggestion { name: string; slug: string; icon?: string | null }
export interface SuggestResult {
  shops: ShopSuggestion[];
  services: string[];
  categories: CategorySuggestion[];
  cities: string[];
}

/** Debounce a fast-changing value so we don't fire a request per keystroke. */
export function useDebounced<T>(value: T, ms = 160): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function useSearchSuggest(q: string) {
  const debounced = useDebounced(q.trim(), 160);
  return useQuery<SuggestResult>({
    queryKey: ['suggest', debounced],
    enabled: debounced.length >= 2,
    staleTime: 60_000, // suggestions barely change; cache aggressively
    queryFn: async () =>
      (await api.get<SuggestResult>('/saloons/suggest', { params: { q: debounced } })).data,
  });
}
