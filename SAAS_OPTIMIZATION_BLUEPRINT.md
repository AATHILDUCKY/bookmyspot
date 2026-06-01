# BookMySaloon Production SaaS Blueprint

This blueprint defines the target architecture for turning the current app into a premium salon booking SaaS inspired by Google Calendar, Notion Calendar, Fresha, Booksy, and modern admin platforms.

## 1. Full Application Architecture

- Frontend: Next.js App Router, TypeScript, TailwindCSS, shadcn/ui, React Query, Zustand for UI state, server components for public SEO pages.
- API: FastAPI currently implemented. If migrating to a Node-first stack, use NestJS or Next.js route handlers plus Prisma. Avoid mixing two write APIs long-term.
- Database: PostgreSQL as the system of record.
- ORM: SQLAlchemy today. Prisma is a good future migration if the backend moves to Node.js.
- Realtime: WebSockets or Socket.IO channels by salon, staff, booking, and admin workspace.
- Cache/queues: Redis for availability cache, rate limits, presence, BullMQ/Celery queues, notification fanout, and payment webhooks.
- Media: Cloudinary or S3 for salon galleries, staff photos, review images, and optimized WebP/AVIF variants.
- Payments: Stripe Checkout/PaymentIntents, Apple Pay, Google Pay, deposits, refunds, and commission splitting with Stripe Connect.
- Deployment: Docker containers behind Nginx reverse proxy with PostgreSQL, Redis, backend workers, cron jobs, and CDN-backed media.

## 2. Optimized Feature List

- Customer: search, nearby salons, map view, multi-service booking, staff selection, recurring appointments, payment wallet, loyalty, coupons, reviews with photos, invoices, refund tracking.
- Owner: visual calendar, staff schedules, service categories, add-ons, dynamic pricing, shift planning, leave management, inventory, CRM notes, commission tracking, revenue forecasting.
- Admin: platform analytics, user management, salon KYC/approval, dispute handling, subscription plans, fraud signals, reports, moderation, billing controls.
- Platform: notifications, audit logs, RBAC, device sessions, 2FA, waitlist, smart reminders, SEO pages.

## 3. Dashboard Wireframe Ideas

- Customer home: hero card with next appointment, quick booking CTA, offers strip, saved salons, recommended salons, loyalty progress, notification inbox.
- Owner home: today timeline, live pending bookings, revenue cards, setup checklist, staff activity, cancellation risk, peak-hour heatmap, calendar mini-map.
- Owner calendar: left mini calendar and filters, center day/week/staff timeline, right appointment drawer with customer CRM, payment, notes, and actions.
- Admin dashboard: platform health, booking volume, GMV/revenue, approval queue, open disputes, growth funnel, suspicious activity, subscription mix.

## 4. PostgreSQL Schema Ideas

- Add `payments`, `refunds`, `subscriptions`, `plans`, `wallet_transactions`, `coupons`, `loyalty_events`.
- Add `service_categories`, `service_addons`, `service_price_rules`, `staff_shifts`, `staff_leaves`, `rooms`, `chairs`.
- Add `customer_profiles` for preferences, favorite stylists, allergies, notes, hair history.
- Add `audit_logs` for sensitive owner/admin actions.
- Add `booking_events` for event-sourcing booking lifecycle changes.
- Add soft delete columns: `deleted_at`, `deleted_by`.
- Add indexes:
  - `bookings(saloon_id, booking_date, start_time, status)`
  - `bookings(staff_id, booking_date, start_time)`
  - `saloons(city, is_approved, is_active)`
  - `reviews(saloon_id, rating)`
  - `notifications(user_id, is_read, created_at DESC)`
  - geospatial index on salon coordinates using PostGIS for nearby search.
- Partition high-volume tables by month: `bookings`, `notifications`, `audit_logs`, `booking_events`.

## 5. API Structure

- `/auth`: register, OTP verify, login, refresh, logout, sessions, 2FA.
- `/customer`: dashboard, profile, preferences, wallet, bookings, reviews, favourites.
- `/saloons`: public discovery, detail, availability, SEO payloads.
- `/owner`: dashboard, calendar, bookings, staff, services, shifts, inventory, CRM, analytics.
- `/admin`: users, salons, reports, disputes, subscriptions, moderation, analytics.
- `/payments`: intents, webhooks, refunds, invoices, saved payment methods.
- `/notifications`: inbox, read state, preferences, realtime stream.

## 6. Folder Structure

```text
frontend/
  app/
  components/
    calendar/
    customer/
    owner/
    admin/
    shared/
    ui/
  lib/
    api/
    auth/
    hooks/
    seo/
    realtime/
    payments/
  stores/
  types/

backend/
  core/
  routers/
  services/
    booking/
    calendar/
    payments/
    notifications/
    analytics/
  workers/
  migrations/
  tests/
```

## 7. Best UI/UX Practices

- Keep all primary touch targets at least 44px.
- Use compact cards on mobile and denser table/calendar views on desktop.
- Keep owner actions close to the appointment card: confirm, reschedule, complete, refund, message.
- Use clear status colors: pending amber, confirmed green, completed blue, cancelled gray/red.
- Use skeleton loading for calendars and dashboards.
- Use empty states with action CTAs.
- Use command palette shortcuts for owner/admin power users.

## 8. Advanced Calendar Architecture

- Store bookings as immutable time intervals with conflict checks at the database and service layer.
- Calendar API should return normalized resources: bookings, staff, rooms/chairs, services, availability, exceptions.
- Support views: day, week, month, staff, room/chair, agenda, timeline.
- Drag/drop calls `PATCH /owner/bookings/:id/move`.
- Resize calls `PATCH /owner/bookings/:id/duration`.
- Conflict detection should check overlapping intervals, staff availability, room availability, service duration, and break times.
- Smart gap filling ranks slots by staff utilization, revenue potential, and customer preference.

## 9. Real-Time Architecture

- WebSocket namespaces:
  - `salon:{salonId}:calendar`
  - `user:{userId}:notifications`
  - `admin:platform`
- Events:
  - `booking.created`
  - `booking.confirmed`
  - `booking.moved`
  - `booking.cancelled`
  - `payment.succeeded`
  - `notification.created`
- Use Redis pub/sub or streams to fan out events across multiple API instances.

## 10. Notification Architecture

- Store all notifications in PostgreSQL.
- Push realtime events over WebSocket/SSE.
- Send async jobs through Redis queues.
- Channels: email, SMS, WhatsApp, in-app, push.
- Preferences per user: reminders, marketing, booking updates, payment updates.
- Retry failed jobs with exponential backoff and dead-letter queues.

## 11. Security Best Practices

- RBAC per route and per resource ownership.
- Rate limit login, OTP, registration, search, and booking creation.
- JWT access tokens short-lived; refresh tokens rotated and stored server-side hashed.
- Add device/session tracking and logout by device.
- Use CSRF protection if auth moves to cookies.
- Validate all payloads with Pydantic/Zod.
- Store audit logs for admin/owner changes.
- Add 2FA for owners/admins.
- Use Stripe webhooks with signature verification.
- Sanitize image uploads and restrict MIME types/sizes.

## 12. Revenue Features

- Subscription plans for salons: free, pro, premium.
- Stripe Connect commission per booking.
- Featured salon placement.
- Deposits and cancellation fees.
- Coupons and campaign tracking.
- Loyalty points and membership plans.
- Add-on marketplace: SMS bundles, premium analytics, AI assistant.

## 13. SaaS Scaling Ideas

- Cache public salon cards and search filters in Redis.
- Precompute salon ratings and popularity metrics.
- Use materialized views for admin analytics.
- Queue notifications and analytics events.
- Separate read-heavy public search from transactional booking writes.
- Add idempotency keys for booking and payment APIs.
- Use CDN for media and static assets.

## 14. Production Deployment Architecture

- Nginx reverse proxy routes `/api` to backend and frontend to Next.js.
- Services: frontend, backend API, worker, scheduler, PostgreSQL, Redis.
- Use Docker Compose for staging and Kubernetes/ECS/Fly/Render for production.
- Run Alembic/Prisma migrations as a release step.
- Add health checks, structured logs, Sentry, Prometheus metrics, and uptime monitoring.

## 15. Suggested NPM Packages

- UI/calendar: `@fullcalendar/react`, `@fullcalendar/timegrid`, `@dnd-kit/core`, `cmdk`, `vaul`.
- State/data: `@tanstack/react-query`, `zustand`.
- Forms: `react-hook-form`, `zod`, `@hookform/resolvers`.
- Charts: `recharts` or `@visx/xychart`.
- Payments: `@stripe/stripe-js`, `@stripe/react-stripe-js`.
- Realtime: `socket.io-client`.
- SEO/schema: `schema-dts`.
- PWA: `next-pwa`.

## 16. Prisma Schema Improvements

- Use enums for roles, booking status, payment status, subscription status, report status.
- Use composite indexes for booking availability checks.
- Model `BookingEvent` separately from `Booking`.
- Store money as integer cents in Node/Prisma systems.
- Use `Decimal` only when necessary; prefer `priceCents Int`.
- Add explicit relation names for owner/customer/user relations.

## 17. Booking Flow Optimization

- Step 1: service bundle selection with add-ons.
- Step 2: staff preference or “any professional”.
- Step 3: date/time grid with realtime availability and best-slot suggestions.
- Step 4: notes, coupon, deposit/payment.
- Step 5: confirmation, calendar add, directions, cancellation policy.
- Always lock slots during payment using short-lived Redis holds.

## 18. Mobile UX Optimization

- Bottom nav for customer and owner.
- Full-screen mobile slot picker.
- Bottom sheets for filters and booking details.
- Swipe between calendar days.
- Sticky booking summary.
- PWA install, offline shell, cached upcoming bookings.

## 19. Admin Analytics Ideas

- GMV, net revenue, commission, refunds.
- Bookings by city, category, device, acquisition channel.
- Salon activation funnel: registered, setup complete, approved, first booking.
- Fraud dashboard: repeated cancellations, fake reviews, payment failures.
- Retention cohorts for customers and salons.
- Subscription MRR, churn, upgrades, downgrades.
