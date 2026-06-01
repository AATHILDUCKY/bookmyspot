'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, Heart, Home, LayoutDashboard, LogIn, Search, Settings, ShieldAlert, Sparkles, Store, UserCog, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; Icon: typeof Home; highlight?: boolean };

export function MobileBottomNav() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  let items: NavItem[];
  if (loading) {
    // Render the guest-shape during auth bootstrap so we don't flash logged-in tabs.
    items = guestItems(pathname);
  } else if (user?.role === 'owner') {
    items = [
      { href: '/owner/dashboard', label: 'Today', Icon: Home },
      { href: '/owner/bookings', label: 'Bookings', Icon: CalendarDays },
      { href: '/owner/saloon/setup', label: 'Setup', Icon: Settings },
      { href: '/owner/analytics', label: 'Stats', Icon: BarChart3 },
      { href: '/profile', label: 'Profile', Icon: UserRound },
    ];
  } else if (user?.role === 'admin') {
    items = [
      { href: '/admin/dashboard', label: 'Home', Icon: Home },
      { href: '/admin/saloons', label: 'Shops', Icon: Store },
      { href: '/admin/analytics', label: 'Stats', Icon: BarChart3 },
      { href: '/admin/reports', label: 'Reports', Icon: ShieldAlert },
      { href: '/admin/users', label: 'Users', Icon: UserCog },
      { href: '/profile', label: 'Profile', Icon: UserRound },
    ];
  } else if (user) {
    items = [
      { href: '/customer/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
      { href: '/shops', label: 'Search', Icon: Search },
      { href: '/bookings', label: 'Bookings', Icon: CalendarDays },
      { href: '/favourites', label: 'Saved', Icon: Heart },
      { href: '/profile', label: 'Profile', Icon: UserRound },
    ];
  } else {
    items = guestItems(pathname);
  }

  return (
    <nav className='fixed inset-x-0 bottom-0 z-50 md:hidden pb-[env(safe-area-inset-bottom)]'>
      {/* Floating gradient backdrop */}
      <div className='relative border-t border-border/40 bg-white/85 backdrop-blur-2xl shadow-nav'>
        {/* Subtle top sheen */}
        <div className='absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent' />

        <div
          className={cn(
            'max-w-lg mx-auto px-1.5 pt-1.5 pb-1 grid',
            items.length === 4 && 'grid-cols-4',
            items.length === 5 && 'grid-cols-5',
            items.length === 6 && 'grid-cols-6',
          )}
        >
          {items.map(({ href, label, Icon, highlight }) => {
            const hrefPath = href.split('?')[0];
            const isActive =
              hrefPath === '/'
                ? pathname === '/'
                : pathname === hrefPath || pathname.startsWith(hrefPath + '/');
            if (highlight) {
              return (
                <Link
                  key={href}
                  href={href}
                  className='relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl active:scale-95 transition'
                >
                  <span className='absolute inset-x-1 top-1 bottom-1 rounded-2xl bg-gradient-to-br from-brand-sage to-emerald-600 shadow-sm' />
                  <span className='relative z-10 text-white -translate-y-0.5'>
                    <Icon size={19} strokeWidth={2.4} />
                  </span>
                  <span className='relative z-10 text-[10px] font-semibold text-white'>{label}</span>
                </Link>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-all duration-200',
                  isActive ? 'text-brand-ink' : 'text-muted-foreground hover:text-foreground active:scale-95',
                )}
              >
                {isActive && (
                  <span className='absolute inset-x-1 top-1 bottom-1 rounded-2xl bg-gradient-to-br from-brand-ink to-[#2a2724] shadow-sm' />
                )}
                <span className={cn('relative z-10 transition-transform', isActive && 'text-white -translate-y-0.5')}>
                  <Icon size={19} strokeWidth={isActive ? 2.4 : 1.75} />
                </span>
                <span className={cn(
                  'relative z-10 text-[10px] font-medium transition-all',
                  isActive ? 'text-white font-semibold' : '',
                )}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function guestItems(pathname: string): NavItem[] {
  const next = encodeURIComponent(pathname || '/');
  return [
    { href: '/', label: 'Home', Icon: Home },
    { href: '/shops', label: 'Search', Icon: Search },
    { href: `/login?next=${next}`, label: 'Sign in', Icon: LogIn, highlight: true },
    { href: '/register', label: 'Join', Icon: Sparkles },
  ];
}
