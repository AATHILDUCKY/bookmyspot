'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SaloonReviewsPage } from '@/types';

const PAGE_SIZE = 5;

/**
 * Paginated shop reviews. Fetches 5 at a time; `fetchNextPage` loads the next
 * 5 on demand so the page never pulls the whole review history at once.
 */
export function useSaloonReviews(saloonId: number | undefined) {
  return useInfiniteQuery<SaloonReviewsPage>({
    queryKey: ['saloon-reviews', saloonId],
    enabled: saloonId != null,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (await api.get<SaloonReviewsPage>(`/saloons/${saloonId}/reviews`, {
        params: { page: pageParam, limit: PAGE_SIZE },
      })).data,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
  });
}
