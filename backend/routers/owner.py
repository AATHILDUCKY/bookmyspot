from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from core.database import get_db
from core.security import require_role
from models import AvailabilitySlot, Booking, BookingStatus, Category, Saloon, SaloonCategory, SaloonImage, Service, Staff, StaffService, User
from schemas import (
    AvailabilityBulkUpsert,
    OwnerCalendarOut,
    OwnerSaloonCreate,
    OwnerSaloonUpdate,
    OwnerBookingMove,
    OwnerServiceCreate,
    OwnerServiceUpdate,
    OwnerStaffCreate,
    OwnerStaffUpdate,
)
from services.booking_service import calc_end_time


router = APIRouter(prefix='/owner', tags=['owner'])


def _owner_saloon_or_404(db: Session, owner_id: int, saloon_id: int):
    s = db.query(Saloon).filter(Saloon.id == saloon_id, Saloon.owner_id == owner_id).first()
    if not s:
        raise HTTPException(status_code=404, detail='Saloon not found')
    return s


SERVICE_COLORS = ['#5B21B6', '#0F766E', '#C2410C', '#0369A1', '#BE123C', '#4338CA', '#15803D']


def _booking_color(service_id: int):
    return SERVICE_COLORS[service_id % len(SERVICE_COLORS)]


def _serialize_calendar_booking(booking: Booking):
    return {
        'id': booking.id,
        'customer_id': booking.customer_id,
        'customer_name': booking.customer.name if booking.customer else f'Customer #{booking.customer_id}',
        'customer_phone': booking.customer.phone if booking.customer else None,
        'saloon_id': booking.saloon_id,
        'saloon_name': booking.saloon.name if booking.saloon else f'Saloon #{booking.saloon_id}',
        'service_id': booking.service_id,
        'service_name': booking.service.name if booking.service else f'Service #{booking.service_id}',
        'service_price': booking.service.price if booking.service else 0,
        'service_duration_minutes': booking.service.duration_minutes if booking.service else 0,
        'staff_id': booking.staff_id,
        'staff_name': booking.staff.name if booking.staff else None,
        'booking_date': booking.booking_date,
        'start_time': booking.start_time,
        'end_time': booking.end_time,
        'status': booking.status.value if hasattr(booking.status, 'value') else str(booking.status),
        'payment_status': 'unpaid',
        'notes': booking.notes,
        'color': _booking_color(booking.service_id),
    }


def _assert_no_booking_conflict(db: Session, booking: Booking, booking_date: date, start_time, end_time, staff_id: int | None):
    q = db.query(Booking).filter(
        Booking.id != booking.id,
        Booking.saloon_id == booking.saloon_id,
        Booking.booking_date == booking_date,
        Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
        Booking.start_time < end_time,
        Booking.end_time > start_time,
    )
    if staff_id:
        q = q.filter(Booking.staff_id == staff_id)
    else:
        q = q.filter(Booking.staff_id.is_(None))
    if q.first():
        raise HTTPException(status_code=409, detail='This move conflicts with another appointment')


def _set_saloon_categories(db: Session, saloon_id: int, category_ids: list[int]) -> None:
    db.query(SaloonCategory).filter(SaloonCategory.saloon_id == saloon_id).delete(synchronize_session=False)
    if not category_ids:
        return
    unique_ids = list(dict.fromkeys(category_ids))
    valid_ids = {cid for (cid,) in db.query(Category.id).filter(Category.id.in_(unique_ids)).all()}
    for cid in unique_ids:
        if cid in valid_ids:
            db.add(SaloonCategory(saloon_id=saloon_id, category_id=cid))


@router.post('/saloons')
def create_saloon(payload: OwnerSaloonCreate, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    data = payload.model_dump()
    category_ids = data.pop('category_ids', []) or []
    s = Saloon(owner_id=user.id, **data)
    db.add(s)
    db.flush()
    _set_saloon_categories(db, s.id, category_ids)
    db.commit()
    db.refresh(s)
    return s


@router.get('/saloons/me')
def my_saloons(user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    return (
        db.query(Saloon)
        .options(
            selectinload(Saloon.services),
            selectinload(Saloon.staff),
            selectinload(Saloon.images),
            selectinload(Saloon.categories),
            selectinload(Saloon.availability_slots),
        )
        .filter(Saloon.owner_id == user.id)
        .all()
    )


@router.patch('/saloons/{id}')
def update_saloon(id: int, payload: OwnerSaloonUpdate, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    s = _owner_saloon_or_404(db, user.id, id)
    data = payload.model_dump(exclude_unset=True)
    category_ids = data.pop('category_ids', None)
    for k, v in data.items():
        setattr(s, k, v)
    if category_ids is not None:
        _set_saloon_categories(db, s.id, category_ids)
    db.commit()
    db.refresh(s)
    return s


@router.post('/saloons/{id}/images')
def add_image(id: int, body: dict, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    _owner_saloon_or_404(db, user.id, id)
    img = SaloonImage(saloon_id=id, url=body.get('url'), order=body.get('order', 0))
    db.add(img)
    db.commit()
    db.refresh(img)
    return img


@router.delete('/saloons/{id}/images/{img_id}')
def del_image(id: int, img_id: int, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    _owner_saloon_or_404(db, user.id, id)
    img = db.query(SaloonImage).filter(SaloonImage.id == img_id, SaloonImage.saloon_id == id).first()
    if img:
        db.delete(img)
        db.commit()
    return {'ok': True}


@router.post('/services')
def create_service(payload: OwnerServiceCreate, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    _owner_saloon_or_404(db, user.id, payload.saloon_id)
    svc = Service(**payload.model_dump())
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return svc


@router.patch('/services/{id}')
def update_service(id: int, payload: OwnerServiceUpdate, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    svc = db.query(Service).join(Saloon).filter(Service.id == id, Saloon.owner_id == user.id).first()
    if not svc:
        raise HTTPException(status_code=404, detail='Service not found')
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(svc, k, v)
    db.commit()
    db.refresh(svc)
    return svc


@router.delete('/services/{id}')
def delete_service(id: int, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    svc = db.query(Service).join(Saloon).filter(Service.id == id, Saloon.owner_id == user.id).first()
    if svc:
        db.delete(svc)
        db.commit()
    return {'ok': True}


@router.post('/staff')
def create_staff(payload: OwnerStaffCreate, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    _owner_saloon_or_404(db, user.id, payload.saloon_id)
    data = payload.model_dump()
    service_ids = data.pop('service_ids', [])
    st = Staff(**data)
    db.add(st)
    db.flush()
    for service_id in service_ids:
        service = db.query(Service).filter(Service.id == service_id, Service.saloon_id == payload.saloon_id).first()
        if service:
            db.add(StaffService(staff_id=st.id, service_id=service_id))
    db.commit()
    db.refresh(st)
    return st


@router.patch('/staff/{id}')
def update_staff(id: int, payload: OwnerStaffUpdate, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    st = db.query(Staff).join(Saloon).filter(Staff.id == id, Saloon.owner_id == user.id).first()
    if not st:
        raise HTTPException(status_code=404, detail='Staff not found')
    for k, v in payload.model_dump(exclude_unset=True).items():
        if k == 'service_ids':
            db.query(StaffService).filter(StaffService.staff_id == st.id).delete()
            for service_id in v or []:
                service = db.query(Service).filter(Service.id == service_id, Service.saloon_id == st.saloon_id).first()
                if service:
                    db.add(StaffService(staff_id=st.id, service_id=service_id))
        else:
            setattr(st, k, v)
    db.commit()
    db.refresh(st)
    return st


@router.delete('/staff/{id}')
def delete_staff(id: int, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    st = db.query(Staff).join(Saloon).filter(Staff.id == id, Saloon.owner_id == user.id).first()
    if st:
        db.delete(st)
        db.commit()
    return {'ok': True}


@router.post('/availability')
def bulk_upsert_availability(payload: AvailabilityBulkUpsert, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    _owner_saloon_or_404(db, user.id, payload.saloon_id)
    if not payload.slots:
        raise HTTPException(status_code=400, detail='Add at least one availability slot')
    for slot in payload.slots:
        if slot.end_time <= slot.start_time:
            raise HTTPException(status_code=400, detail='End time must be after start time')
        if slot.saloon_id != payload.saloon_id:
            raise HTTPException(status_code=400, detail='Availability slot saloon mismatch')
    db.query(AvailabilitySlot).filter(AvailabilitySlot.saloon_id == payload.saloon_id).delete()
    for slot in payload.slots:
        data = slot.model_dump()
        data['saloon_id'] = payload.saloon_id
        db.add(AvailabilitySlot(**data))
    db.commit()
    return {'ok': True}


@router.get('/bookings')
def owner_bookings(status: str | None = None, date: date | None = None, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    q = (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.service), joinedload(Booking.staff), joinedload(Booking.saloon))
        .join(Saloon)
        .filter(Saloon.owner_id == user.id)
    )
    if status:
        q = q.filter(Booking.status == status)
    if date:
        q = q.filter(Booking.booking_date == date)
    return q.order_by(Booking.booking_date.desc()).all()


@router.get('/calendar', response_model=OwnerCalendarOut)
def owner_calendar(
    start_date: date | None = None,
    end_date: date | None = None,
    staff_id: int | None = None,
    saloon_id: int | None = None,
    user: User = Depends(require_role('owner')),
    db: Session = Depends(get_db),
):
    today = date.today()
    window_start = start_date or (today - timedelta(days=today.weekday()))
    window_end = end_date or (window_start + timedelta(days=6))
    if window_end < window_start:
        raise HTTPException(status_code=400, detail='end_date must be after start_date')
    if (window_end - window_start).days > 62:
        raise HTTPException(status_code=400, detail='Calendar window cannot exceed 63 days')

    saloon_query = db.query(Saloon).filter(Saloon.owner_id == user.id)
    if saloon_id:
        saloon_query = saloon_query.filter(Saloon.id == saloon_id)
    saloon_ids = [row.id for row in saloon_query.all()]
    if not saloon_ids:
        return {'start_date': window_start, 'end_date': window_end, 'bookings': [], 'staff': [], 'services': [], 'summary': {}}

    bookings_q = (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.service), joinedload(Booking.staff), joinedload(Booking.saloon))
        .filter(
            Booking.saloon_id.in_(saloon_ids),
            Booking.booking_date >= window_start,
            Booking.booking_date <= window_end,
        )
    )
    if staff_id:
        bookings_q = bookings_q.filter(Booking.staff_id == staff_id)

    bookings = bookings_q.order_by(Booking.booking_date.asc(), Booking.start_time.asc()).all()
    staff = db.query(Staff).filter(Staff.saloon_id.in_(saloon_ids), Staff.is_active.is_(True)).order_by(Staff.name.asc()).all()
    services = db.query(Service).filter(Service.saloon_id.in_(saloon_ids), Service.is_active.is_(True)).order_by(Service.name.asc()).all()
    confirmed = [b for b in bookings if b.status == BookingStatus.confirmed]
    completed = [b for b in bookings if b.status == BookingStatus.completed]
    pending = [b for b in bookings if b.status == BookingStatus.pending]
    cancelled = [b for b in bookings if b.status == BookingStatus.cancelled]
    revenue = sum(float(b.service.price) for b in completed if b.service)

    return {
        'start_date': window_start,
        'end_date': window_end,
        'bookings': [_serialize_calendar_booking(booking) for booking in bookings],
        'staff': staff,
        'services': services,
        'summary': {
            'total': len(bookings),
            'confirmed': len(confirmed),
            'pending': len(pending),
            'completed': len(completed),
            'cancelled': len(cancelled),
            'revenue': revenue,
        },
    }


@router.patch('/bookings/{id}/move')
def move_booking(id: int, payload: OwnerBookingMove, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.service), joinedload(Booking.staff), joinedload(Booking.saloon))
        .join(Saloon)
        .filter(Booking.id == id, Saloon.owner_id == user.id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail='Booking not found')
    service = booking.service or db.query(Service).filter(Service.id == booking.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail='Service not found')
    if payload.staff_id:
        staff = db.query(Staff).filter(Staff.id == payload.staff_id, Staff.saloon_id == booking.saloon_id, Staff.is_active.is_(True)).first()
        if not staff:
            raise HTTPException(status_code=404, detail='Staff member not found')
    end_time = calc_end_time(payload.booking_date, payload.start_time, service.duration_minutes)
    _assert_no_booking_conflict(db, booking, payload.booking_date, payload.start_time, end_time, payload.staff_id)
    booking.booking_date = payload.booking_date
    booking.start_time = payload.start_time
    booking.end_time = end_time
    booking.staff_id = payload.staff_id
    booking.status = BookingStatus.confirmed
    db.commit()
    db.refresh(booking)

    # Notify the customer that their booking was rescheduled by the salon.
    from services.notification_service import create_notification as _notify  # local import to avoid cycle
    _notify(
        db,
        booking.customer_id,
        'Booking rescheduled',
        f'Your booking #{booking.id} was moved to {booking.booking_date} at {booking.start_time.strftime("%H:%M")}.',
        'booking',
        entity_type='booking',
        entity_id=booking.id,
    )
    return _serialize_calendar_booking(booking)


@router.patch('/bookings/{id}/confirm')
def confirm_booking(id: int, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    b = db.query(Booking).join(Saloon).filter(Booking.id == id, Saloon.owner_id == user.id).first()
    if not b:
        raise HTTPException(status_code=404, detail='Booking not found')
    b.status = BookingStatus.confirmed
    db.commit()
    db.refresh(b)
    return b


@router.patch('/bookings/{id}/complete')
def complete_booking(id: int, user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    b = (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.service), joinedload(Booking.staff), joinedload(Booking.saloon))
        .join(Saloon)
        .filter(Booking.id == id, Saloon.owner_id == user.id)
        .first()
    )
    if not b:
        raise HTTPException(status_code=404, detail='Booking not found')
    if b.status == BookingStatus.cancelled:
        raise HTTPException(status_code=400, detail='Cancelled bookings cannot be completed')
    if b.status == BookingStatus.completed:
        return _serialize_calendar_booking(b)
    b.status = BookingStatus.completed
    db.commit()
    db.refresh(b)

    from services.notification_service import create_notification as _notify  # local import to avoid cycle
    _notify(
        db,
        b.customer_id,
        'Ready for your review',
        f'Your visit to {b.saloon.name if b.saloon else "the shop"} is complete. Share a rating and review when you have a moment.',
        'review',
        entity_type='booking',
        entity_id=b.id,
    )
    return _serialize_calendar_booking(b)


@router.get('/analytics')
def owner_analytics(user: User = Depends(require_role('owner')), db: Session = Depends(get_db)):
    bookings_q = db.query(Booking).join(Saloon).filter(Saloon.owner_id == user.id)
    total_bookings = bookings_q.count()
    revenue = bookings_q.join(Service, Booking.service_id == Service.id).with_entities(func.coalesce(func.sum(Service.price), 0)).scalar()
    peak_hours = (
        bookings_q.with_entities(func.extract('hour', Booking.start_time).label('hour'), func.count().label('count'))
        .group_by('hour')
        .order_by(func.count().desc())
        .limit(5)
        .all()
    )
    popular_services = (
        bookings_q.join(Service, Booking.service_id == Service.id)
        .with_entities(Service.name, func.count().label('count'))
        .group_by(Service.name)
        .order_by(func.count().desc())
        .limit(5)
        .all()
    )
    monthly_trend = (
        bookings_q.with_entities(func.date_trunc('month', Booking.booking_date).label('month'), func.count().label('count'))
        .group_by('month')
        .order_by('month')
        .all()
    )

    return {
        'total_bookings': total_bookings,
        'revenue': float(revenue or 0),
        'peak_hours': [{'hour': int(x.hour), 'count': x.count} for x in peak_hours],
        'popular_services': [{'name': x.name, 'count': x.count} for x in popular_services],
        'monthly_trend': [{'month': str(x.month), 'count': x.count} for x in monthly_trend],
    }
