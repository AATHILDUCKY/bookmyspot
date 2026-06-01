from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None


class UserOut(UserBase):
    id: int
    role: str
    avatar_url: str | None = None
    city: str | None = None
    district: str | None = None
    province: str | None = None
    address: str | None = None
    is_active: bool
    deleted_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    avatar_data_url: str | None = None
    city: str | None = None
    district: str | None = None
    province: str | None = None
    address: str | None = None


class AuthRegister(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str = Field(min_length=6)
    role: str
    city: str | None = None
    district: str | None = None
    province: str | None = None
    address: str | None = None


class VerifyOtpIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=8)


class ResendOtpIn(BaseModel):
    email: EmailStr


class AuthLogin(BaseModel):
    email: EmailStr
    password: str


class TokenRefreshIn(BaseModel):
    refresh_token: str


class TokenPairOut(BaseModel):
    access_token: str
    refresh_token: str
    user: UserOut


class SaloonImageOut(BaseModel):
    id: int
    url: str
    order: int

    class Config:
        from_attributes = True


class ServiceOut(BaseModel):
    id: int
    saloon_id: int
    name: str
    description: str | None
    price: Decimal
    duration_minutes: int
    is_active: bool

    class Config:
        from_attributes = True


class StaffOut(BaseModel):
    id: int
    saloon_id: int
    name: str
    avatar_url: str | None
    bio: str | None
    is_active: bool

    class Config:
        from_attributes = True


class ReviewOut(BaseModel):
    id: int
    booking_id: int
    customer_id: int
    saloon_id: int
    rating: int
    comment: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    sort_order: int = 0
    is_active: bool = True

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str
    slug: str | None = None
    description: str | None = None
    icon: str | None = None
    sort_order: int = 0
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    icon: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class SaloonOut(BaseModel):
    id: int
    owner_id: int
    name: str
    description: str | None
    address: str
    city: str
    lat: float | None
    lng: float | None
    phone: str
    email: str | None
    cover_image: str | None
    is_approved: bool
    is_active: bool
    is_open: bool = True
    created_at: datetime
    categories: list[CategoryOut] = Field(default_factory=list)
    followers_count: int = 0

    class Config:
        from_attributes = True


class SaloonListOut(SaloonOut):
    avg_rating: float = 0
    top_services: list[str] = Field(default_factory=list)
    distance_km: float | None = None
    min_price: Decimal | None = None


class ShopSuggestion(BaseModel):
    id: int
    name: str
    city: str


class CategorySuggestion(BaseModel):
    name: str
    slug: str
    icon: str | None = None


class SuggestOut(BaseModel):
    """Grouped type-ahead suggestions for the search box."""
    shops: list[ShopSuggestion] = Field(default_factory=list)
    services: list[str] = Field(default_factory=list)
    categories: list[CategorySuggestion] = Field(default_factory=list)
    cities: list[str] = Field(default_factory=list)


class SaloonNearbyOut(BaseModel):
    """Lean payload for map markers — only what a pin/popup needs."""
    id: int
    name: str
    city: str
    address: str
    lat: float
    lng: float
    cover_image: str | None = None
    is_open: bool = True
    avg_rating: float = 0
    min_price: Decimal | None = None
    distance_km: float

    class Config:
        from_attributes = True


class ReviewPublicOut(BaseModel):
    """A single review as shown publicly on a shop page."""
    id: int
    rating: int
    comment: str | None = None
    created_at: datetime
    customer_name: str
    service_name: str | None = None


class RatingSummaryOut(BaseModel):
    average: float = 0
    count: int = 0
    # Star → number of reviews, e.g. {"5": 12, "4": 3, ...}.
    distribution: dict[int, int] = Field(default_factory=dict)


class SaloonReviewsOut(BaseModel):
    summary: RatingSummaryOut
    reviews: list[ReviewPublicOut] = Field(default_factory=list)
    page: int
    limit: int
    has_more: bool = False


class SaloonDetailOut(SaloonOut):
    images: list[SaloonImageOut] = Field(default_factory=list)
    services: list[ServiceOut] = Field(default_factory=list)
    staff: list[StaffOut] = Field(default_factory=list)
    reviews: list[ReviewOut] = Field(default_factory=list)
    reviews_count: int = 0
    avg_rating: float = 0


class BookingCreate(BaseModel):
    saloon_id: int
    service_id: int
    staff_id: int | None = None
    booking_date: date
    start_time: time
    notes: str | None = None


class BookingOut(BaseModel):
    id: int
    customer_id: int
    saloon_id: int
    service_id: int
    staff_id: int | None
    booking_date: date
    start_time: time
    end_time: time
    status: str
    notes: str | None
    created_at: datetime
    # Enriched display fields (populated by /bookings/me).
    saloon_name: str | None = None
    saloon_city: str | None = None
    saloon_cover_image: str | None = None
    service_name: str | None = None
    service_price: Decimal | None = None
    service_duration_minutes: int | None = None
    # Review state — lets the UI show "Rate your visit" vs the submitted rating.
    has_review: bool = False
    review_rating: int | None = None
    review_comment: str | None = None

    class Config:
        from_attributes = True


class BookingReschedule(BaseModel):
    booking_date: date
    start_time: time


class OwnerBookingMove(BaseModel):
    booking_date: date
    start_time: time
    staff_id: int | None = None


class OwnerCalendarBookingOut(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    customer_phone: str | None = None
    saloon_id: int
    saloon_name: str
    service_id: int
    service_name: str
    service_price: Decimal
    service_duration_minutes: int
    staff_id: int | None = None
    staff_name: str | None = None
    booking_date: date
    start_time: time
    end_time: time
    status: str
    payment_status: str = 'unpaid'
    notes: str | None = None
    color: str


class OwnerCalendarOut(BaseModel):
    start_date: date
    end_date: date
    bookings: list[OwnerCalendarBookingOut]
    staff: list[StaffOut]
    services: list[ServiceOut]
    summary: dict[str, int | float]


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class OwnerSaloonCreate(BaseModel):
    name: str
    description: str | None = None
    address: str
    city: str
    lat: float | None = None
    lng: float | None = None
    phone: str
    email: EmailStr | None = None
    cover_image: str | None = None
    category_ids: list[int] = Field(default_factory=list)


class OwnerSaloonUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address: str | None = None
    city: str | None = None
    lat: float | None = None
    lng: float | None = None
    phone: str | None = None
    email: EmailStr | None = None
    cover_image: str | None = None
    is_active: bool | None = None
    is_open: bool | None = None
    category_ids: list[int] | None = None


class OwnerServiceCreate(BaseModel):
    saloon_id: int
    name: str
    price: Decimal
    duration_minutes: int
    description: str | None = None


class OwnerServiceUpdate(BaseModel):
    name: str | None = None
    price: Decimal | None = None
    duration_minutes: int | None = None
    description: str | None = None
    is_active: bool | None = None


class OwnerStaffCreate(BaseModel):
    saloon_id: int
    name: str
    avatar_url: str | None = None
    bio: str | None = None
    service_ids: list[int] = Field(default_factory=list)


class OwnerStaffUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    is_active: bool | None = None
    service_ids: list[int] | None = None


class AvailabilitySlotIn(BaseModel):
    saloon_id: int
    staff_id: int | None = None
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    max_bookings: int = Field(default=1, ge=1)
    is_active: bool = True


class AvailabilityBulkUpsert(BaseModel):
    saloon_id: int
    slots: list[AvailabilitySlotIn]


class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    body: str
    type: str
    entity_type: str | None = None
    entity_id: int | None = None
    link: str | None = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReportCreate(BaseModel):
    review_id: int | None = None
    saloon_id: int | None = None
    reason: str
    details: str | None = None
    images: list[str] | None = None  # data:image/webp;base64,... up to 3


class ReportImageOut(BaseModel):
    id: int
    url: str

    class Config:
        from_attributes = True


class ReportOut(BaseModel):
    id: int
    reporter_id: int
    review_id: int | None
    saloon_id: int | None
    reason: str
    details: str | None
    status: str
    created_at: datetime
    images: list[ReportImageOut] = []

    class Config:
        from_attributes = True
