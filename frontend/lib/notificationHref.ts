import { Notification, Role } from '@/types';

// Compute deep-link target for a notification.
// Order: explicit backend `link` → entity-type mapping → notification-type fallback → null.
export function notificationHref(notif: Notification, role?: Role): string | null {
  if (notif.link) return notif.link;

  const { entity_type, entity_id, type } = notif;

  if (entity_type === 'booking' && entity_id) {
    if (role === 'owner') return '/owner/bookings';
    if (role === 'admin') return '/admin/dashboard';
    return `/bookings/${entity_id}`;
  }
  if (entity_type === 'saloon' && entity_id) {
    if (role === 'owner') return '/owner/saloon/setup';
    return `/shops/${entity_id}`;
  }
  if (entity_type === 'review' && entity_id) {
    return role === 'owner' ? '/owner/dashboard' : '/profile';
  }
  if (entity_type === 'report' && entity_id) {
    return role === 'admin' ? '/admin/reports' : null;
  }

  // Fallbacks by notification type
  if (type === 'booking' || type === 'queue') {
    return role === 'owner' ? '/owner/bookings' : '/bookings';
  }
  if (type === 'auth') return '/profile';

  return null;
}
