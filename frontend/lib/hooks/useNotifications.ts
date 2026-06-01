'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Notification } from '@/types';
import { playNotificationTing } from '@/lib/notificationSound';

interface UnreadStat {
  count: number;
  last_id: number;
}

// Full list. No polling — refreshed only when the lightweight counter detects a new id.
export function useNotifications(enabled = true) {
  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    enabled,
    queryFn: async () => (await api.get('/notifications', { params: { limit: 50 } })).data,
    staleTime: 60_000,
  });
}

// Tiny aggregate. Indexed scan, ~30 bytes per response. Hot polling path.
export function useUnreadNotificationCount(enabled = true) {
  return useQuery<UnreadStat>({
    queryKey: ['notifications-count'],
    enabled,
    refetchInterval: enabled ? 15_000 : false,
    refetchIntervalInBackground: false,
    queryFn: async () => (await api.get('/notifications/unread-count')).data,
    staleTime: 10_000,
  });
}

// Combined center: list + counter + mutations + new-notification chime.
//
// Algorithm:
//   1) Count query polls every 15s, returning max(id) for this user.
//   2) A ref tracks the previously-seen id (O(1), no list scan).
//   3) When max(id) advances, refetch the full list once and play the chime.
//   4) Mark-as-read uses single UPDATE … WHERE (no SELECT) on the backend
//      with optimistic cache mutation on the client.
export function useNotificationCenter(enabled = true) {
  const qc = useQueryClient();
  const list = useNotifications(enabled);
  const counter = useUnreadNotificationCount(enabled);
  const lastSeenIdRef = useRef<number>(0);

  useEffect(() => {
    const newest = counter.data?.last_id ?? 0;
    if (!newest) return;
    if (lastSeenIdRef.current === 0) {
      lastSeenIdRef.current = newest;
      return;
    }
    if (newest > lastSeenIdRef.current) {
      lastSeenIdRef.current = newest;
      list.refetch();
      playNotificationTing();
    }
  }, [counter.data?.last_id, list]);

  const markRead = useMutation({
    mutationFn: async (id: number) => api.post(`/notifications/${id}/read`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const prev = qc.getQueryData<Notification[]>(['notifications']);
      qc.setQueryData<Notification[]>(['notifications'], (old) =>
        old?.map((n) => (n.id === id ? { ...n, is_read: true } : n)) ?? old,
      );
      qc.setQueryData<UnreadStat>(['notifications-count'], (old) =>
        old ? { ...old, count: Math.max(0, old.count - 1) } : old,
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['notifications-count'] }); },
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const prev = qc.getQueryData<Notification[]>(['notifications']);
      qc.setQueryData<Notification[]>(['notifications'], (old) =>
        old?.map((n) => (n.is_read ? n : { ...n, is_read: true })) ?? old,
      );
      qc.setQueryData<UnreadStat>(['notifications-count'], (old) =>
        old ? { ...old, count: 0 } : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['notifications-count'] }); },
  });

  return {
    notifications: list.data ?? [],
    isLoading: list.isLoading,
    unreadCount: counter.data?.count ?? 0,
    markAsRead: (id: number) => markRead.mutate(id),
    markAllAsRead: () => markAllRead.mutate(),
  };
}
