'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  Store,
  Tag,
  UserCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; Icon: LucideIcon };

const PRIMARY: Item[] = [
  { href: '/admin/dashboard',  label: 'Overview',   Icon: LayoutDashboard },
  { href: '/admin/saloons',    label: 'Shops',      Icon: Store },
  { href: '/admin/users',      label: 'Users',      Icon: UserCog },
  { href: '/admin/reports',    label: 'Reports',    Icon: ShieldAlert },
  { href: '/admin/categories', label: 'Categories', Icon: Tag },
  { href: '/admin/analytics',  label: 'Analytics',  Icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className='hidden md:flex flex-col sticky top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-60 lg:w-64 shrink-0 border-r border-border bg-white/85 backdrop-blur-sm'>
      {/* Section label */}
      <div className='px-5 pt-5 pb-3'>
        <p className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground'>
          Admin console
        </p>
        <p className='mt-0.5 text-sm font-semibold text-foreground'>Platform control</p>
      </div>

      <div className='mx-3 mb-2 h-px bg-border/60' />

      {/* Primary nav */}
      <nav className='flex-1 overflow-y-auto px-2.5 py-1 space-y-0.5'>
        {PRIMARY.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-gradient-to-r from-brand-ink to-[#2a2724] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2.4 : 1.9} />
              <span>{label}</span>
              {isActive && (
                <span className='ml-auto h-1.5 w-1.5 rounded-full bg-brand-sage' />
              )}
            </Link>
          );
        })}

      </nav>

      {/* Account footer */}
      <div className='border-t border-border p-3'>
        <div className='flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2.5'>
          <div className='h-8 w-8 rounded-xl bg-gradient-to-br from-brand-ink to-[#2a2724] text-white flex items-center justify-center text-xs font-bold shrink-0'>
            {(user?.name || 'A').slice(0, 1).toUpperCase()}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='text-xs font-semibold text-foreground truncate'>{user?.name || 'Admin'}</p>
            <p className='text-[10px] text-muted-foreground truncate'>{user?.email}</p>
          </div>
          <button
            onClick={logout}
            aria-label='Log out'
            className='h-8 w-8 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center shrink-0'
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
