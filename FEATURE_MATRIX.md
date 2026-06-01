# Book My Saloon Feature Matrix

## Phase 1 Critical

- Owner registration: `/register`, `/auth/register`, `/auth/verify-otp`
- Saloon profile: owner setup profile tab, `/owner/saloons`
- Service management: owner setup services tab, `/owner/services`
- Slot availability: owner setup slots tab, `/owner/availability`
- Staff management: owner setup staff tab, `/owner/staff`
- Gallery upload by URL: owner setup gallery tab, `/owner/saloons/{id}/images`
- Booking dashboard: `/owner/bookings`
- Owner notifications: `/notifications`, `/notifications/stream`
- Customer registration/login: `/register`, `/login`
- Search/filter: `/saloons?q=&city=&service=&rating=&sort=distance`
- Location results: GPS filter on `/saloons`, `distance_km` on saloon cards
- Saloon detail: services, staff, reviews, map, save/report actions
- Slot booking: `/saloons/{id}/book`, `/bookings`
- Real-time availability source: `/saloons/{id}/availability`
- Confirmation: notification plus SendGrid email when configured
- Cancel/reschedule APIs: `/bookings/{id}/cancel`, `/bookings/{id}/reschedule`
- Booking history/detail: `/bookings`, `/bookings/{id}`
- Admin approval: `/admin/saloons`
- User suspend/delete: `/admin/users`
- Platform analytics: `/admin/dashboard`
- Report management: `/admin/reports`

## High Priority Launch Items

- Favourites: `/favourites`, `/favourites/{saloon_id}`
- Ratings and reviews: `/bookings/{id}/review`
- Queue/wait alert: `/bookings/{id}/queue`
- Analytics: owner and admin analytics endpoints and pages

## Phase 2 Roadmap

- Google OAuth
- Paid uploads/storage instead of image URLs
- Offers and coupons
- Loyalty points
- Live chat
- AI hairstyle suggestions
- Recurring bookings
