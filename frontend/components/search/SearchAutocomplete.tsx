'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Scissors, Search, Store, Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSearchSuggest,
  type CategorySuggestion,
  type ShopSuggestion,
} from '@/lib/hooks/useSearchSuggest';

type Item =
  | { kind: 'free'; label: string }
  | { kind: 'shop'; label: string; shop: ShopSuggestion }
  | { kind: 'service'; label: string }
  | { kind: 'category'; label: string; cat: CategorySuggestion }
  | { kind: 'city'; label: string };

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelectShop: (s: ShopSuggestion) => void;
  onSelectService: (name: string) => void;
  onSelectCategory: (c: CategorySuggestion) => void;
  onSelectCity: (city: string) => void;
  /** Enter pressed with no highlighted suggestion (plain text search). */
  onSubmit?: (v: string) => void;
  placeholder?: string;
  wrapperClassName?: string;
  inputClassName?: string;
}

export function SearchAutocomplete({
  value,
  onChange,
  onSelectShop,
  onSelectService,
  onSelectCategory,
  onSelectCity,
  onSubmit,
  placeholder = 'Search shops, services, categories…',
  wrapperClassName,
  inputClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const { data, isFetching } = useSearchSuggest(value);
  const term = value.trim();

  // Flatten the grouped result into a single keyboard-navigable list.
  const items = useMemo<Item[]>(() => {
    if (term.length < 2) return [];
    const list: Item[] = [{ kind: 'free', label: term }];
    data?.shops.forEach((s) => list.push({ kind: 'shop', label: s.name, shop: s }));
    data?.services.forEach((name) => list.push({ kind: 'service', label: name }));
    data?.categories.forEach((c) => list.push({ kind: 'category', label: c.name, cat: c }));
    data?.cities.forEach((city) => list.push({ kind: 'city', label: city }));
    return list;
  }, [data, term]);

  // Reset highlight whenever the list changes.
  useEffect(() => { setActive(-1); }, [items.length, term]);

  // Close on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const showDropdown = open && term.length >= 2 && (isFetching || items.length > 1);

  function choose(item: Item) {
    switch (item.kind) {
      case 'free': onSubmit?.(item.label); break;
      case 'shop': onSelectShop(item.shop); break;
      case 'service': onSelectService(item.label); break;
      case 'category': onSelectCategory(item.cat); break;
      case 'city': onSelectCity(item.label); break;
    }
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown) {
      if (e.key === 'Enter') { onSubmit?.(value); setOpen(false); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[active >= 0 ? active : 0]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div ref={wrapperRef} className={cn('relative', wrapperClassName)}>
      <Search size={17} className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none' />
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role='combobox'
        aria-expanded={showDropdown}
        aria-autocomplete='list'
        className={cn(
          'w-full h-11 rounded-xl border border-border bg-white pl-10 pr-9 text-sm transition-all',
          'focus:outline-none focus:border-brand-sage focus:ring-2 focus:ring-brand-sage/15',
          inputClassName,
        )}
      />
      {value && (
        <button
          onClick={() => { onChange(''); setOpen(false); }}
          className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
          aria-label='Clear search'
        >
          <X size={16} />
        </button>
      )}

      {showDropdown && (
        <div className='absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl border border-border bg-white shadow-xl overflow-hidden animate-fade-in'>
          {/* Free-text search row */}
          <SuggestRow
            active={active === 0}
            onMouseEnter={() => setActive(0)}
            onClick={() => choose(items[0])}
            icon={<Search size={15} className='text-brand-sage' />}
            primary={<>Search for “<span className='font-semibold text-foreground'>{term}</span>”</>}
          />

          {isFetching && items.length <= 1 && (
            <div className='flex items-center gap-2 px-3.5 py-3 text-xs text-muted-foreground'>
              <Loader2 size={14} className='animate-spin' /> Searching…
            </div>
          )}

          {renderGroup('Shops', items, 'shop', active, term, setActive, choose)}
          {renderGroup('Services', items, 'service', active, term, setActive, choose)}
          {renderGroup('Categories', items, 'category', active, term, setActive, choose)}
          {renderGroup('Cities', items, 'city', active, term, setActive, choose)}
        </div>
      )}
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────────────── */

function renderGroup(
  title: string,
  items: Item[],
  kind: Item['kind'],
  active: number,
  term: string,
  setActive: (i: number) => void,
  choose: (item: Item) => void,
) {
  const rows = items.map((it, i) => ({ it, i })).filter(({ it }) => it.kind === kind);
  if (rows.length === 0) return null;
  return (
    <div className='border-t border-border/60 first:border-t-0'>
      <p className='px-3.5 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>{title}</p>
      {rows.map(({ it, i }) => (
        <SuggestRow
          key={`${kind}-${i}`}
          active={active === i}
          onMouseEnter={() => setActive(i)}
          onClick={() => choose(it)}
          icon={iconFor(kind)}
          primary={<Highlight text={it.label} term={term} />}
          secondary={it.kind === 'shop' ? it.shop.city : undefined}
        />
      ))}
    </div>
  );
}

function iconFor(kind: Item['kind']) {
  if (kind === 'shop') return <Store size={15} className='text-brand-ink' />;
  if (kind === 'service') return <Scissors size={15} className='text-brand-ink' />;
  if (kind === 'category') return <Tag size={15} className='text-brand-ink' />;
  if (kind === 'city') return <MapPin size={15} className='text-brand-ink' />;
  return <Search size={15} className='text-brand-sage' />;
}

function SuggestRow({
  active, onMouseEnter, onClick, icon, primary, secondary,
}: {
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  icon: React.ReactNode;
  primary: React.ReactNode;
  secondary?: string;
}) {
  return (
    <button
      type='button'
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => e.preventDefault()} // keep input focus through the click
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors',
        active ? 'bg-brand-peach/30' : 'hover:bg-muted/40',
      )}
    >
      <span className='h-7 w-7 shrink-0 rounded-lg bg-muted/60 flex items-center justify-center'>{icon}</span>
      <span className='min-w-0 flex-1'>
        <span className='block text-sm text-foreground truncate'>{primary}</span>
        {secondary && <span className='block text-[11px] text-muted-foreground truncate'>{secondary}</span>}
      </span>
    </button>
  );
}

/** Bold the matched portion of a label. */
function Highlight({ text, term }: { text: string; term: string }) {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0 || !term) return <span className='text-muted-foreground'>{text}</span>;
  return (
    <span className='text-muted-foreground'>
      {text.slice(0, i)}
      <span className='font-semibold text-foreground'>{text.slice(i, i + term.length)}</span>
      {text.slice(i + term.length)}
    </span>
  );
}
