'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Heart, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { SaloonCard } from '@/components/shared/SaloonCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Saloon } from '@/types';

export default function FavouritesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data, isLoading } = useQuery<{ items: Saloon[] }>({
    queryKey: ['favourites'],
    queryFn: async () => (await api.get('/favourites')).data,
    staleTime: 60_000,
  });
  const deferredSearch = useDeferredValue(searchTerm.trim().toLowerCase());
  const favourites = data?.items ?? [];
  const filteredFavourites = useMemo(() => {
    if (!deferredSearch) return favourites;
    return favourites.filter((saloon) => {
      const searchPool = [
        saloon.name,
        saloon.city,
        saloon.address,
        saloon.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchPool.includes(deferredSearch);
    });
  }, [favourites, deferredSearch]);
  const hasFavourites = favourites.length > 0;
  const hasSearch = deferredSearch.length > 0;

  return (
    <div className='mx-auto max-w-5xl px-4 py-8 space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <div className='h-11 w-11 rounded-2xl bg-brand-peach flex items-center justify-center'>
          <Heart size={20} className='text-brand-ink' />
        </div>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>Saved Favourites</h1>
          <p className='text-sm text-muted-foreground'>Your saved shops in one place.</p>
        </div>
      </div>

      {hasFavourites && (
        <div className='relative'>
          <Search
            size={16}
            className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none'
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='Search favourites by name, city, or address...'
            className='pl-9 rounded-xl'
            aria-label='Search favourite shops'
          />
        </div>
      )}

      {isLoading ? (
        <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className='rounded-2xl border overflow-hidden bg-white'>
              <Skeleton className='h-44 rounded-none' />
              <div className='p-4 space-y-2'>
                <Skeleton className='h-4 w-3/4' />
                <Skeleton className='h-3 w-1/2' />
              </div>
            </div>
          ))}
        </div>
      ) : hasFavourites && filteredFavourites.length ? (
        <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          {filteredFavourites.map((saloon) => <SaloonCard key={saloon.id} saloon={saloon} />)}
        </div>
      ) : hasFavourites && hasSearch ? (
        <div className='flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border'>
          <div className='h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4'>
            <Search size={24} className='text-muted-foreground' />
          </div>
          <p className='font-semibold text-foreground'>No matches found</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            Try a different keyword for your favourite shops.
          </p>
        </div>
      ) : (
        <div className='flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-border'>
          <div className='h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4'>
            <Heart size={28} className='text-muted-foreground' />
          </div>
          <p className='font-semibold text-foreground'>No saved shops yet</p>
          <p className='mt-1 text-sm text-muted-foreground'>Save shops you love to find them easily later.</p>
          <Link href='/shops' className='mt-4'>
            <Button variant='outline' className='rounded-xl gap-2'>
              <Search size={16} /> Explore shops
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
