import enum
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    customer = 'customer'
    owner = 'owner'
    admin = 'admin'


class BookingStatus(str, enum.Enum):
    pending = 'pending'
    confirmed = 'confirmed'
    completed = 'completed'
    cancelled = 'cancelled'


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(30), unique=True, index=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name='user_role'), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    province: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    owned_saloons: Mapped[list['Saloon']] = relationship(back_populates='owner', cascade='all, delete-orphan')
    customer_bookings: Mapped[list['Booking']] = relationship(back_populates='customer')
    notifications: Mapped[list['Notification']] = relationship(back_populates='user', cascade='all, delete-orphan')
    favourite_saloons: Mapped[list['Favourite']] = relationship(back_populates='customer', cascade='all, delete-orphan')
    reviews: Mapped[list['Review']] = relationship(back_populates='customer')


class Saloon(Base):
    __tablename__ = 'saloons'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cover_image: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default='true')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index('ix_saloons_city_visibility', 'city', 'is_approved', 'is_active'),
        # Powers the bounding-box pre-filter in GET /saloons/nearby.
        Index('ix_saloons_lat_lng', 'lat', 'lng'),
    )

    owner: Mapped['User'] = relationship(back_populates='owned_saloons')
    images: Mapped[list['SaloonImage']] = relationship(back_populates='saloon', cascade='all, delete-orphan')
    staff: Mapped[list['Staff']] = relationship(back_populates='saloon', cascade='all, delete-orphan')
    services: Mapped[list['Service']] = relationship(back_populates='saloon', cascade='all, delete-orphan')
    category_links: Mapped[list['SaloonCategory']] = relationship(back_populates='saloon', cascade='all, delete-orphan')
    categories: Mapped[list['Category']] = relationship(secondary='saloon_categories', viewonly=True, order_by='Category.sort_order')
    availability_slots: Mapped[list['AvailabilitySlot']] = relationship(back_populates='saloon', cascade='all, delete-orphan')
    slot_exceptions: Mapped[list['SlotException']] = relationship(back_populates='saloon', cascade='all, delete-orphan')
    bookings: Mapped[list['Booking']] = relationship(back_populates='saloon')
    reviews: Mapped[list['Review']] = relationship(back_populates='saloon')
    favourites: Mapped[list['Favourite']] = relationship(back_populates='saloon', cascade='all, delete-orphan')


class SaloonImage(Base):
    __tablename__ = 'saloon_images'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    saloon_id: Mapped[int] = mapped_column(ForeignKey('saloons.id', ondelete='CASCADE'), index=True, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    saloon: Mapped['Saloon'] = relationship(back_populates='images')


class Staff(Base):
    __tablename__ = 'staff'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    saloon_id: Mapped[int] = mapped_column(ForeignKey('saloons.id', ondelete='CASCADE'), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    saloon: Mapped['Saloon'] = relationship(back_populates='staff')
    services: Mapped[list['StaffService']] = relationship(back_populates='staff', cascade='all, delete-orphan')
    availability_slots: Mapped[list['AvailabilitySlot']] = relationship(back_populates='staff')
    bookings: Mapped[list['Booking']] = relationship(back_populates='staff')


class Service(Base):
    __tablename__ = 'services'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    saloon_id: Mapped[int] = mapped_column(ForeignKey('saloons.id', ondelete='CASCADE'), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(140), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    saloon: Mapped['Saloon'] = relationship(back_populates='services')
    staff_links: Mapped[list['StaffService']] = relationship(back_populates='service', cascade='all, delete-orphan')
    bookings: Mapped[list['Booking']] = relationship(back_populates='service')


class StaffService(Base):
    __tablename__ = 'staff_services'

    staff_id: Mapped[int] = mapped_column(ForeignKey('staff.id', ondelete='CASCADE'), primary_key=True)
    service_id: Mapped[int] = mapped_column(ForeignKey('services.id', ondelete='CASCADE'), primary_key=True)

    staff: Mapped['Staff'] = relationship(back_populates='services')
    service: Mapped['Service'] = relationship(back_populates='staff_links')


class AvailabilitySlot(Base):
    __tablename__ = 'availability_slots'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    saloon_id: Mapped[int] = mapped_column(ForeignKey('saloons.id', ondelete='CASCADE'), index=True, nullable=False)
    staff_id: Mapped[Optional[int]] = mapped_column(ForeignKey('staff.id', ondelete='SET NULL'), index=True, nullable=True)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    max_bookings: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        CheckConstraint('weekday >= 0 AND weekday <= 6', name='chk_availability_weekday_range'),
    )

    saloon: Mapped['Saloon'] = relationship(back_populates='availability_slots')
    staff: Mapped[Optional['Staff']] = relationship(back_populates='availability_slots')


class SlotException(Base):
    __tablename__ = 'slot_exceptions'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    saloon_id: Mapped[int] = mapped_column(ForeignKey('saloons.id', ondelete='CASCADE'), index=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint('saloon_id', 'date', name='uq_slot_exception_saloon_date'),
    )

    saloon: Mapped['Saloon'] = relationship(back_populates='slot_exceptions')


class Booking(Base):
    __tablename__ = 'bookings'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False)
    saloon_id: Mapped[int] = mapped_column(ForeignKey('saloons.id', ondelete='CASCADE'), index=True, nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey('services.id', ondelete='CASCADE'), index=True, nullable=False)
    staff_id: Mapped[Optional[int]] = mapped_column(ForeignKey('staff.id', ondelete='SET NULL'), index=True, nullable=True)
    booking_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus, name='booking_status'), default=BookingStatus.pending, nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index('ix_bookings_saloon_calendar', 'saloon_id', 'booking_date', 'start_time', 'status'),
        Index('ix_bookings_staff_calendar', 'staff_id', 'booking_date', 'start_time'),
        Index('ix_bookings_customer_history', 'customer_id', 'booking_date', 'status'),
    )

    customer: Mapped['User'] = relationship(back_populates='customer_bookings')
    saloon: Mapped['Saloon'] = relationship(back_populates='bookings')
    service: Mapped['Service'] = relationship(back_populates='bookings')
    staff: Mapped[Optional['Staff']] = relationship(back_populates='bookings')
    review: Mapped[Optional['Review']] = relationship(back_populates='booking', uselist=False, cascade='all, delete-orphan')


class Review(Base):
    __tablename__ = 'reviews'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey('bookings.id', ondelete='CASCADE'), unique=True, nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False)
    saloon_id: Mapped[int] = mapped_column(ForeignKey('saloons.id', ondelete='CASCADE'), index=True, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint('rating >= 1 AND rating <= 5', name='chk_review_rating_range'),
        # Newest-first pagination of a shop's reviews.
        Index('ix_reviews_saloon_recent', 'saloon_id', 'created_at'),
    )

    booking: Mapped['Booking'] = relationship(back_populates='review')
    customer: Mapped['User'] = relationship(back_populates='reviews')
    saloon: Mapped['Saloon'] = relationship(back_populates='reviews')


class Favourite(Base):
    __tablename__ = 'favourites'

    customer_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    saloon_id: Mapped[int] = mapped_column(ForeignKey('saloons.id', ondelete='CASCADE'), primary_key=True)

    customer: Mapped['User'] = relationship(back_populates='favourite_saloons')
    saloon: Mapped['Saloon'] = relationship(back_populates='favourites')


class Notification(Base):
    __tablename__ = 'notifications'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    link: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index('ix_notifications_inbox', 'user_id', 'is_read', 'created_at'),
    )

    user: Mapped['User'] = relationship(back_populates='notifications')


class OtpCode(Base):
    __tablename__ = 'otp_codes'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(12), nullable=False)
    purpose: Mapped[str] = mapped_column(String(40), default='registration', nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ReportStatus(str, enum.Enum):
    open = 'open'
    resolved = 'resolved'
    dismissed = 'dismissed'


class Category(Base):
    __tablename__ = 'categories'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    saloon_links: Mapped[list['SaloonCategory']] = relationship(back_populates='category', cascade='all, delete-orphan')


class SaloonCategory(Base):
    __tablename__ = 'saloon_categories'

    saloon_id: Mapped[int] = mapped_column(ForeignKey('saloons.id', ondelete='CASCADE'), primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey('categories.id', ondelete='CASCADE'), primary_key=True)

    saloon: Mapped['Saloon'] = relationship(back_populates='category_links')
    category: Mapped['Category'] = relationship(back_populates='saloon_links')


class Report(Base):
    __tablename__ = 'reports'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False)
    review_id: Mapped[Optional[int]] = mapped_column(ForeignKey('reviews.id', ondelete='CASCADE'), index=True, nullable=True)
    saloon_id: Mapped[Optional[int]] = mapped_column(ForeignKey('saloons.id', ondelete='CASCADE'), index=True, nullable=True)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus, name='report_status'), default=ReportStatus.open, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    images: Mapped[list['ReportImage']] = relationship(back_populates='report', cascade='all, delete-orphan')


class ReportImage(Base):
    __tablename__ = 'report_images'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey('reports.id', ondelete='CASCADE'), index=True, nullable=False)
    url: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    report: Mapped['Report'] = relationship(back_populates='images')
