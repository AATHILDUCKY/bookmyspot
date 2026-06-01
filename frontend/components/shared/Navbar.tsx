'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellOff,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  Store,
  UserRound,
  Scissors,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/auth';
import { useNotificationCenter } from '@/lib/hooks/useNotifications';
import { isNotificationSoundEnabled, setNotificationSoundEnabled } from '@/lib/notificationSound';
import { notificationHref } from '@/lib/notificationHref';
import { Notification } from '@/types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead } = useNotificationCenter(Boolean(user));
  const recent = useMemo(() => notifications.slice(0, 8), [notifications]);

  useEffect(() => {
    setSoundOn(isNotificationSoundEnabled());
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setNotificationSoundEnabled(next);
  }

  function handleNotifClick(item: Notification) {
    if (!item.is_read) markAsRead(item.id);
    const href = notificationHref(item, user?.role);
    setNotifOpen(false);
    if (href) router.push(href);
  }
  const dashboardHref =
    user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'owner' ? '/owner/dashboard' : '/customer/dashboard';

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) setNotifOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <header className='sticky top-0 z-50 glass-bar border-b'>
      <div className='mx-auto max-w-7xl px-4 h-14 sm:h-16 flex items-center justify-between gap-3'>
        {/* Logo */}
        <Link href='/' className='inline-flex items-center gap-2.5 min-h-11 rounded-xl group'>
          <div className='h-8 w-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-ink to-[#2a2724] shadow-sm'>
            <Scissors size={15} className='text-white' strokeWidth={2.5} />
          </div>
          <span className='text-base font-bold tracking-tight text-foreground'>
            <span className='text-brand-sage'>book</span>myspot
          </span>
        </Link>

        {/* Desktop search */}
        <Link
          href='/shops'
          className='hidden md:flex items-center gap-2.5 bg-muted/60 hover:bg-muted rounded-2xl px-4 h-10 text-sm text-muted-foreground transition-colors border border-border/40 flex-1 max-w-md'
        >
          <Search size={15} className='text-brand-sage' />
          <span>Search shops, services, locations…</span>
          <kbd className='ml-auto hidden lg:inline-flex h-5 items-center rounded border border-border bg-white/60 px-1.5 text-[10px] font-mono text-muted-foreground'>
            ⌘K
          </kbd>
        </Link>

        {/* Right actions */}
        <div className='flex items-center gap-1.5'>
          {user && (
            <Link href={dashboardHref} aria-label='Dashboard' className='hidden sm:flex h-9 w-9 rounded-xl border border-border/60 bg-white/50 hover:bg-muted/60 transition-colors items-center justify-center'>
              {user.role === 'customer' ? <CalendarDays size={17} /> : <LayoutDashboard size={17} />}
            </Link>
          )}

          {/* Notification bell — signed-in users only */}
          <div ref={wrapRef} className={cn('relative', !user && 'hidden')}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              aria-label='Notifications'
              className='relative h-9 w-9 rounded-xl border border-border/60 bg-white/50 hover:bg-muted/60 transition-colors flex items-center justify-center'
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className='absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white'>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className='absolute right-0 mt-2 w-[22rem] max-w-[95vw] rounded-2xl border border-border bg-white shadow-2xl shadow-black/10 animate-fade-in overflow-hidden'>
                {/* Header */}
                <div className='flex items-center justify-between gap-2 border-b border-border px-4 py-3 bg-gradient-to-r from-brand-peach/30 to-white'>
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-foreground'>Notifications</p>
                    <p className='text-[11px] text-muted-foreground'>
                      {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                    </p>
                  </div>
                  <div className='flex items-center gap-1 shrink-0'>
                    <button
                      onClick={toggleSound}
                      title={soundOn ? 'Mute notification sound' : 'Enable notification sound'}
                      aria-label='Toggle notification sound'
                      className='h-7 w-7 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors'
                    >
                      {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
                    </button>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllAsRead()}
                        title='Mark all as read'
                        className='inline-flex items-center gap-1 h-7 rounded-lg border border-border bg-white px-2 text-[10px] font-semibold text-brand-ink hover:bg-muted/50 transition-colors'
                      >
                        <CheckCheck size={11} />
                        Read all
                      </button>
                    )}
                  </div>
                </div>

                {/* List */}
                <div className='max-h-96 overflow-y-auto'>
                  {isLoading && (
                    <div className='p-6 flex items-center justify-center'>
                      <div className='h-5 w-5 rounded-full border-2 border-muted border-t-brand-sage animate-spin' />
                    </div>
                  )}
                  {!isLoading && !recent.length && (
                    <div className='py-10 flex flex-col items-center text-center px-6'>
                      <div className='h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-2'>
                        <BellOff size={18} className='text-muted-foreground' />
                      </div>
                      <p className='text-sm font-medium text-foreground'>No notifications yet</p>
                      <p className='text-[11px] text-muted-foreground mt-0.5'>
                        Booking updates and alerts will appear here.
                      </p>
                    </div>
                  )}
                  {recent.map((item) => {
                    const Icon = iconForType(item);
                    const tint = tintForType(item.type);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNotifClick(item)}
                        className={cn(
                          'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border/60 last:border-b-0 hover:bg-muted/40 transition-colors',
                          !item.is_read && 'bg-brand-peach/15',
                        )}
                      >
                        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', tint)}>
                          <Icon size={15} />
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-start justify-between gap-2'>
                            <p className={cn('text-sm leading-snug truncate', !item.is_read ? 'font-bold text-foreground' : 'font-medium text-foreground')}>
                              {item.title}
                            </p>
                            {!item.is_read && <span className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-sage' />}
                          </div>
                          <p className='mt-0.5 text-xs text-muted-foreground line-clamp-2'>{item.body}</p>
                          <p className='mt-1 text-[10px] text-muted-foreground/70'>
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {recent.length > 0 && (
                  <Link
                    href={dashboardHref}
                    onClick={() => setNotifOpen(false)}
                    className='block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-brand-sage hover:bg-brand-peach/20 transition-colors'
                  >
                    View all activity →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Desktop profile / logout */}
          {user ? (
            <>
              <Link href='/profile' className='hidden md:flex h-9 w-9 rounded-xl border border-border/60 bg-white/50 hover:bg-muted/60 transition-colors items-center justify-center'>
                <UserRound size={17} />
              </Link>
              <button onClick={logout} className='hidden md:flex h-9 w-9 rounded-xl border border-border/60 bg-white/50 hover:bg-red-50 hover:border-red-200 transition-colors items-center justify-center text-muted-foreground hover:text-red-600'>
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <div className='hidden md:flex items-center gap-2'>
              <Link href='/login'>
                <Button variant='ghost' size='sm'>Login</Button>
              </Link>
              <Link href='/register'>
                <Button variant='gradient' size='sm' className='rounded-xl'>Get started</Button>
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <Sheet>
            <SheetTrigger asChild>
              <button aria-label='Open menu' className='md:hidden h-9 w-9 rounded-xl border border-border/60 bg-white/50 hover:bg-muted/60 transition-colors flex items-center justify-center'>
                <Menu size={17} />
              </button>
            </SheetTrigger>
            <SheetContent side='right' className='w-72 p-0'>
              <SheetHeader className='px-5 pt-6 pb-4 border-b'>
                <SheetTitle className='flex items-center gap-2.5'>
                  <div className='h-8 w-8 flex items-center justify-center rounded-lg bg-brand-ink'>
                    <Scissors size={15} className='text-white' strokeWidth={2.5} />
                  </div>
                  <span className='font-bold'><span className='text-brand-sage'>book</span>myspot</span>
                </SheetTitle>
              </SheetHeader>
              <nav className='flex flex-col py-2'>
                <MobileNavLink href='/shops' icon={<Search size={17} />} label='Search shops' />
                {user ? (
                  <>
                    <MobileNavLink href={dashboardHref} icon={<LayoutDashboard size={17} />} label='Dashboard' />
                    <MobileNavLink href='/profile' icon={<UserRound size={17} />} label='Profile' />
                    <div className='mx-4 my-2 h-px bg-border' />
                    <button
                      onClick={logout}
                      className='flex items-center gap-3 px-5 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors'
                    >
                      <LogOut size={17} />
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <MobileNavLink href='/login' icon={<UserRound size={17} />} label='Login' />
                    <MobileNavLink href='/register' icon={<Store size={17} />} label='Create account' />
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function iconForType(notif: Notification): LucideIcon {
  const t = notif.entity_type || notif.type;
  if (t === 'booking') return CalendarClock;
  if (t === 'queue') return CalendarDays;
  if (t === 'review') return Sparkles;
  if (t === 'report') return ShieldAlert;
  if (t === 'auth') return UserRound;
  return Bell;
}

function tintForType(type: string): string {
  switch (type) {
    case 'booking': return 'bg-brand-peach/60 text-brand-ink';
    case 'queue':   return 'bg-amber-100 text-amber-700';
    case 'review':  return 'bg-brand-sage/20 text-brand-sage';
    case 'report':  return 'bg-red-100 text-red-700';
    case 'auth':    return 'bg-brand-blue/40 text-brand-ink';
    default:        return 'bg-muted text-muted-foreground';
  }
}

function MobileNavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className='flex items-center gap-3 px-5 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors'
    >
      <span className='text-brand-sage'>{icon}</span>
      {label}
    </Link>
  );
}
