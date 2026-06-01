from datetime import date

import asyncio
import base64
import binascii
import json
import secrets
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from core.database import get_db
from core.security import get_current_user
from models import Booking, BookingStatus, Favourite, Notification, Report, ReportImage, Review, Saloon, Service, User
from schemas import BookingCreate, BookingOut, BookingReschedule, NotificationOut, ReportCreate, ReviewCreate


REPORT_IMAGE_DIR = Path(__file__).resolve().parents[1] / 'uploads' / 'reports'
REPORT_IMAGE_MAX_BYTES = 500 * 1024  # 500KB per image
REPORT_IMAGE_MAX_COUNT = 3


def _save_report_image(report_id: int, data_url: str, index: int) -> str:
    prefix = 'data:image/webp;base64,'
    if not data_url.startswith(prefix):
        raise HTTPException(status_code=400, detail='Report images must be WebP format')
    try:
        raw = base64.b64decode(data_url[len(prefix):], validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail='Invalid report image data')
    if len(raw) > REPORT_IMAGE_MAX_BYTES:
        raise HTTPException(status_code=400, detail='Each report image must be less than 500KB')
    REPORT_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f'report-{report_id}-{index}-{secrets.token_hex(4)}.webp'
    (REPORT_IMAGE_DIR / filename).write_bytes(raw)
    return f'/static/reports/{filename}'
from services.availability_service import is_slot_bookable
from services.booking_service import create_booking
from services.booking_service import calc_end_time
from services.notification_service import create_notification, send_email


router = APIRouter(tags=['bookings-customer'])


@router.post('/bookings', response_model=BookingOut)
def book(
    payload: BookingCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = create_booking(db, user.id, payload)
    create_notification(
        db, user.id,
        'Booking placed',
        f'Your booking #{b.id} is pending.',
        'booking',
        entity_type='booking', entity_id=b.id,
    )
    saloon = db.query(Saloon).options(selectinload(Saloon.owner)).filter(Saloon.id == b.saloon_id).first()
    owner = saloon.owner if saloon else None
    if owner:
        create_notification(
            db,
            owner.id,
            'New booking received',
            f'Booking #{b.id} is pending for {b.booking_date} at {b.start_time}.',
            'booking',
            entity_type='booking', entity_id=b.id,
        )
        if owner.email:
            background_tasks.add_task(
                send_email,
                owner.email,
                'New booking received',
                f'You received booking #{b.id} for {b.booking_date} at {b.start_time}. Please confirm in owner dashboard.',
            )
    return b


@router.get('/bookings/me', response_model=list[BookingOut])
def my_bookings(filter: str = 'upcoming', user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = (
        db.query(Booking)
        .options(joinedload(Booking.saloon), joinedload(Booking.service))
        .filter(Booking.customer_id == user.id)
    )
    today = date.today()
    if filter == 'upcoming':
        q = q.filter(Booking.booking_date >= today, Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]))
        # Soonest first.
        q = q.order_by(Booking.booking_date.asc(), Booking.start_time.asc())
    elif filter == 'past':
        # Anything finished: past-dated, or marked completed by the owner today.
        q = q.filter(or_(Booking.booking_date < today, Booking.status == BookingStatus.completed))
        q = q.order_by(Booking.booking_date.desc(), Booking.start_time.desc())
    elif filter == 'cancelled':
        q = q.filter(Booking.status == BookingStatus.cancelled)
        q = q.order_by(Booking.booking_date.desc(), Booking.start_time.desc())
    else:
        q = q.order_by(Booking.booking_date.desc())

    rows = q.all()

    # One round-trip to learn which of these bookings already carry a review.
    review_map: dict[int, tuple[int, str | None]] = {}
    if rows:
        ids = [b.id for b in rows]
        for booking_id, rating, comment in (
            db.query(Review.booking_id, Review.rating, Review.comment)
            .filter(Review.booking_id.in_(ids))
            .all()
        ):
            review_map[booking_id] = (rating, comment)

    result = []
    for b in rows:
        review = review_map.get(b.id)
        result.append({
            'id': b.id,
            'customer_id': b.customer_id,
            'saloon_id': b.saloon_id,
            'service_id': b.service_id,
            'staff_id': b.staff_id,
            'booking_date': b.booking_date,
            'start_time': b.start_time,
            'end_time': b.end_time,
            'status': b.status.value if hasattr(b.status, 'value') else b.status,
            'notes': b.notes,
            'created_at': b.created_at,
            'saloon_name': b.saloon.name if b.saloon else None,
            'saloon_city': b.saloon.city if b.saloon else None,
            'saloon_cover_image': b.saloon.cover_image if b.saloon else None,
            'service_name': b.service.name if b.service else None,
            'service_price': b.service.price if b.service else None,
            'service_duration_minutes': b.service.duration_minutes if b.service else None,
            'has_review': review is not None,
            'review_rating': review[0] if review else None,
            'review_comment': review[1] if review else None,
        })
    return result


@router.get('/bookings/{id}', response_model=BookingOut)
def booking_detail(id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = (
        db.query(Booking)
        .options(joinedload(Booking.saloon), joinedload(Booking.service), joinedload(Booking.review))
        .filter(Booking.id == id, Booking.customer_id == user.id)
        .first()
    )
    if not b:
        raise HTTPException(status_code=404, detail='Booking not found')
    review = b.review
    return {
        'id': b.id,
        'customer_id': b.customer_id,
        'saloon_id': b.saloon_id,
        'service_id': b.service_id,
        'staff_id': b.staff_id,
        'booking_date': b.booking_date,
        'start_time': b.start_time,
        'end_time': b.end_time,
        'status': b.status.value if hasattr(b.status, 'value') else b.status,
        'notes': b.notes,
        'created_at': b.created_at,
        'saloon_name': b.saloon.name if b.saloon else None,
        'saloon_city': b.saloon.city if b.saloon else None,
        'saloon_cover_image': b.saloon.cover_image if b.saloon else None,
        'service_name': b.service.name if b.service else None,
        'service_price': b.service.price if b.service else None,
        'service_duration_minutes': b.service.duration_minutes if b.service else None,
        'has_review': review is not None,
        'review_rating': review.rating if review else None,
        'review_comment': review.comment if review else None,
    }


@router.get('/bookings/{id}/queue')
def booking_queue(id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == id, Booking.customer_id == user.id).first()
    if not booking:
        raise HTTPException(status_code=404, detail='Booking not found')
    ahead = db.query(Booking).filter(
        Booking.saloon_id == booking.saloon_id,
        Booking.booking_date == booking.booking_date,
        Booking.start_time < booking.start_time,
        Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
    ).count()
    if ahead <= 1:
        create_notification(
            db, user.id,
            'Your turn is near',
            'Please be ready for your appointment.',
            'queue',
            entity_type='booking', entity_id=booking.id,
        )
    return {'position': ahead + 1, 'estimated_wait_minutes': ahead * 15}


@router.patch('/bookings/{id}/cancel', response_model=BookingOut)
def cancel_booking(id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = (
        db.query(Booking)
        .options(joinedload(Booking.saloon))
        .filter(Booking.id == id, Booking.customer_id == user.id)
        .first()
    )
    if not b:
        raise HTTPException(status_code=404, detail='Booking not found')
    if b.status == BookingStatus.cancelled:
        return b  # idempotent
    b.status = BookingStatus.cancelled
    db.commit()
    db.refresh(b)

    # Notify the saloon owner so they can free the slot / contact the customer.
    owner_id = b.saloon.owner_id if b.saloon else None
    if owner_id:
        create_notification(
            db,
            owner_id,
            'Booking cancelled',
            f'{user.name} cancelled booking #{b.id} for {b.booking_date} at {b.start_time.strftime("%H:%M")}.',
            'booking',
            entity_type='booking',
            entity_id=b.id,
        )
    return b


@router.patch('/bookings/{id}/reschedule', response_model=BookingOut)
def reschedule_booking(id: int, payload: BookingReschedule, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(Booking).filter(Booking.id == id, Booking.customer_id == user.id).first()
    if not b:
        raise HTTPException(status_code=404, detail='Booking not found')
    service = db.query(Service).filter(Service.id == b.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail='Service not found')
    new_end = calc_end_time(payload.booking_date, payload.start_time, service.duration_minutes)
    if not is_slot_bookable(
        db,
        saloon_id=b.saloon_id,
        for_date=payload.booking_date,
        start_time=payload.start_time,
        end_time=new_end,
        staff_id=b.staff_id,
    ):
        raise HTTPException(status_code=400, detail='Selected slot is unavailable. Pick another time.')
    b.booking_date = payload.booking_date
    b.start_time = payload.start_time
    b.end_time = new_end
    b.status = BookingStatus.pending
    db.commit()
    db.refresh(b)
    return b


@router.post('/bookings/{id}/review')
def add_review(id: int, payload: ReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(Booking).filter(Booking.id == id, Booking.customer_id == user.id).first()
    if not b:
        raise HTTPException(status_code=404, detail='Booking not found')
    if b.status != BookingStatus.completed:
        raise HTTPException(status_code=400, detail='Only completed bookings can be reviewed')

    existing = db.query(Review).filter(Review.booking_id == b.id).first()
    if existing:
        raise HTTPException(status_code=400, detail='Review already exists')

    r = Review(booking_id=b.id, customer_id=user.id, saloon_id=b.saloon_id, rating=payload.rating, comment=payload.comment)
    db.add(r)
    db.commit()
    db.refresh(r)

    # Let the owner know a fresh review landed.
    saloon = db.query(Saloon).filter(Saloon.id == b.saloon_id).first()
    if saloon:
        create_notification(
            db, saloon.owner_id,
            'New review',
            f'{user.name} rated {saloon.name} {payload.rating}★.',
            'review',
            entity_type='saloon', entity_id=saloon.id,
        )

    return {
        'id': r.id,
        'rating': r.rating,
        'comment': r.comment,
        'created_at': r.created_at,
        'customer_name': user.name,
    }


@router.post('/reports')
def create_report(payload: ReportCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not payload.review_id and not payload.saloon_id:
        raise HTTPException(status_code=400, detail='Provide review_id or saloon_id')
    reason = (payload.reason or '').strip()
    if not reason:
        raise HTTPException(status_code=400, detail='Reason is required')
    images = payload.images or []
    if len(images) > REPORT_IMAGE_MAX_COUNT:
        raise HTTPException(status_code=400, detail=f'At most {REPORT_IMAGE_MAX_COUNT} images allowed')

    report = Report(
        reporter_id=user.id,
        review_id=payload.review_id,
        saloon_id=payload.saloon_id,
        reason=reason[:255],
        details=payload.details,
    )
    db.add(report)
    db.flush()
    for idx, data_url in enumerate(images):
        url = _save_report_image(report.id, data_url, idx)
        db.add(ReportImage(report_id=report.id, url=url))
    db.commit()
    db.refresh(report)
    return report


@router.get('/favourites')
def list_favourites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    favs = (
        db.query(Favourite)
        .options(selectinload(Favourite.saloon).selectinload(Saloon.services))
        .filter(Favourite.customer_id == user.id)
        .all()
    )
    items = []
    for fav in favs:
        avg = db.query(func.coalesce(func.avg(Review.rating), 0)).filter(Review.saloon_id == fav.saloon_id).scalar() or 0
        items.append(
            {
                **fav.saloon.__dict__,
                'avg_rating': round(float(avg), 2),
                'top_services': [service.name for service in fav.saloon.services[:3] if service.is_active],
            }
        )
    return {'items': items}


@router.post('/favourites/{saloon_id}')
def add_favourite(saloon_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exists = db.query(Favourite).filter(Favourite.customer_id == user.id, Favourite.saloon_id == saloon_id).first()
    if not exists:
        fav = Favourite(customer_id=user.id, saloon_id=saloon_id)
        db.add(fav)
        db.commit()
    return {'ok': True}


@router.delete('/favourites/{saloon_id}')
def delete_favourite(saloon_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = db.query(Favourite).filter(Favourite.customer_id == user.id, Favourite.saloon_id == saloon_id).first()
    if fav:
        db.delete(fav)
        db.commit()
    return {'ok': True}


@router.get('/notifications', response_model=list[NotificationOut])
def my_notifications(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.id.desc())
        .limit(min(limit, 100))
        .all()
    )


@router.get('/notifications/unread-count')
def unread_notification_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Single covered index query — cheap to call on a poll loop.
    row = (
        db.query(
            func.count(Notification.id).label('count'),
            func.max(Notification.id).label('last_id'),
        )
        .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
        .one()
    )
    # Also compute newest id overall (so the client can detect new reads-or-unread alike)
    newest = (
        db.query(func.max(Notification.id))
        .filter(Notification.user_id == user.id)
        .scalar()
    )
    return {'count': int(row.count or 0), 'last_id': int(newest or 0)}


@router.post('/notifications/{notif_id}/read')
def mark_notification_read(notif_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Single UPDATE with WHERE — no SELECT needed.
    updated = (
        db.query(Notification)
        .filter(Notification.id == notif_id, Notification.user_id == user.id, Notification.is_read.is_(False))
        .update({Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return {'ok': True, 'updated': updated}


@router.post('/notifications/read-all')
def mark_all_notifications_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
        .update({Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return {'ok': True, 'updated': updated}


@router.get('/notifications/stream')
def notification_stream(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    async def event_generator():
        last_id = 0
        while True:
            latest = (
                db.query(Notification)
                .filter(Notification.user_id == user.id, Notification.id > last_id)
                .order_by(Notification.id.asc())
                .all()
            )
            for n in latest:
                last_id = n.id
                payload = json.dumps({'id': n.id, 'title': n.title, 'body': n.body, 'type': n.type})
                yield f"event: notification\ndata: {payload}\n\n"
            yield 'event: ping\\ndata: keepalive\\n\\n'
            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), media_type='text/event-stream')
