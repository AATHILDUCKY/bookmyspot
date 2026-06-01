export type Role = 'customer' | 'owner' | 'admin';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  avatar_url?: string | null;
  city?: string | null;
  district?: string | null;
  province?: string | null;
  address?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Service {
  id: number;
  saloon_id: number;
  name: string;
  description?: string | null;
  price: number | string;
  duration_minutes: number;
  is_active: boolean;
}

export interface SaloonImage {
  id: number;
  url: string;
  order: number;
}

export interface Staff {
  id: number;
  saloon_id: number;
  name: string;
  avatar_url?: string | null;
  bio?: string | null;
  is_active: boolean;
}

export interface Review {
  id: number;
  booking_id: number;
  customer_id: number;
  saloon_id: number;
  rating: number;
  comment?: string | null;
  created_at: string;
}

export interface ReviewPublic {
  id: number;
  rating: number;
  comment?: string | null;
  created_at: string;
  customer_name: string;
  service_name?: string | null;
}

export interface RatingSummary {
  average: number;
  count: number;
  distribution: Record<string, number>; // "1".."5" -> count
}

export interface SaloonReviewsPage {
  summary: RatingSummary;
  reviews: ReviewPublic[];
  page: number;
  limit: number;
  has_more: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface Saloon {
  id: number;
  owner_id: number;
  name: string;
  description?: string | null;
  address: string;
  city: string;
  lat?: number | null;
  lng?: number | null;
  phone: string;
  email?: string | null;
  cover_image?: string | null;
  is_approved: boolean;
  is_active: boolean;
  is_open?: boolean;
  created_at: string;
  services?: Service[];
  staff?: Staff[];
  images?: SaloonImage[];
  reviews?: Review[];
  categories?: Category[];
  availability_slots?: AvailabilitySlot[];
  avg_rating?: number;
  followers_count?: number;
  reviews_count?: number;
  top_services?: string[];
  distance_km?: number | null;
  min_price?: number | string | null;
}

export interface Booking {
  id: number;
  customer_id: number;
  saloon_id: number;
  service_id: number;
  staff_id?: number | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  notes?: string | null;
  created_at: string;
  // Enriched fields (present on /bookings/me responses).
  saloon_name?: string | null;
  saloon_city?: string | null;
  saloon_cover_image?: string | null;
  service_name?: string | null;
  service_price?: number | string | null;
  service_duration_minutes?: number | null;
  // Review state for this booking.
  has_review?: boolean;
  review_rating?: number | null;
  review_comment?: string | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface AvailabilitySlot {
  id?: number;
  saloon_id?: number;
  staff_id?: number | null;
  weekday?: number;
  start_time: string;
  end_time: string;
  max_bookings?: number;
  is_active?: boolean;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  body: string;
  type: string;
  entity_type?: string | null;
  entity_id?: number | null;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface OwnerCalendarBooking {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_phone?: string | null;
  saloon_id: number;
  saloon_name: string;
  service_id: number;
  service_name: string;
  service_price: number | string;
  service_duration_minutes: number;
  staff_id?: number | null;
  staff_name?: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  payment_status: 'paid' | 'unpaid' | 'deposit' | 'refunded' | string;
  notes?: string | null;
  color: string;
}

export interface OwnerCalendarSummary {
  total?: number;
  confirmed?: number;
  pending?: number;
  completed?: number;
  cancelled?: number;
  revenue?: number;
}

export interface OwnerCalendarPayload {
  start_date: string;
  end_date: string;
  bookings: OwnerCalendarBooking[];
  staff: Staff[];
  services: Service[];
  summary: OwnerCalendarSummary;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}
