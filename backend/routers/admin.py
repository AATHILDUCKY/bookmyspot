from datetime import date, datetime, timedelta, timezone
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_role
from models import Booking, Category, Report, ReportStatus, Saloon, User, UserRole
from schemas import CategoryCreate, CategoryOut, CategoryUpdate


def _slugify(value: str) -> str:
    import re
    s = re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')
    return s or 'category'


router = APIRouter(prefix='/admin', tags=['admin'])


def _paginate(query, page: int, page_size: int):
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    total = query.count()
    pages = ceil(total / page_size) if total else 1
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return {
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'pages': pages,
        'has_next': page < pages,
        'has_prev': page > 1,
    }


@router.get('/saloons')
def admin_saloons(
    approved: bool | None = None,
    search: str | None = Query(default=None, alias='q'),
    page: int | None = Query(default=None, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_role('admin')),
    db: Session = Depends(get_db),
):
    query = db.query(Saloon)
    if approved is not None:
        query = query.filter(Saloon.is_approved == approved)
    if search:
        like = f'%{search.strip()}%'
        query = query.filter(or_(Saloon.name.ilike(like), Saloon.city.ilike(like), Saloon.address.ilike(like), Saloon.phone.ilike(like), Saloon.email.ilike(like)))
    query = query.order_by(Saloon.created_at.desc())
    if page is not None:
        return _paginate(query, page, page_size)
    return query.all()


@router.patch('/saloons/{id}/approve')
def approve_saloon(id: int, _admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    s = db.query(Saloon).filter(Saloon.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail='Saloon not found')
    s.is_approved = True
    s.is_active = True
    db.commit()
    return {'ok': True}


@router.patch('/saloons/{id}/reject')
def reject_saloon(id: int, _admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    s = db.query(Saloon).filter(Saloon.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail='Saloon not found')
    s.is_approved = False
    s.is_active = False
    db.commit()
    return {'ok': True}


@router.get('/users')
def admin_users(
    status: str = Query(default='all', regex='^(all|active|suspended|deleted)$'),
    role: str | None = Query(default=None, regex='^(customer|owner|admin)$'),
    q: str | None = None,
    page: int | None = Query(default=None, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_role('admin')),
    db: Session = Depends(get_db),
):
    """List users with filters.

    status:
      active    → is_active=true  AND deleted_at IS NULL
      suspended → is_active=false AND deleted_at IS NULL
      deleted   → deleted_at IS NOT NULL
      all       → everything
    """
    query = db.query(User)
    if status == 'active':
        query = query.filter(User.is_active.is_(True), User.deleted_at.is_(None))
    elif status == 'suspended':
        query = query.filter(User.is_active.is_(False), User.deleted_at.is_(None))
    elif status == 'deleted':
        query = query.filter(User.deleted_at.isnot(None))
    if role:
        query = query.filter(User.role == role)
    if q:
        like = f'%{q.strip()}%'
        query = query.filter(or_(User.name.ilike(like), User.email.ilike(like), User.phone.ilike(like)))
    query = query.order_by(User.created_at.desc())
    if page is not None:
        return _paginate(query, page, page_size)
    return query.all()


def _load_non_admin_or_404(db: Session, user_id: int, action: str) -> User:
    """Fetch a user, guarding against actions on admin accounts."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail='User not found')
    if u.role == UserRole.admin:
        raise HTTPException(status_code=403, detail=f'Admin accounts cannot be {action}.')
    return u


@router.patch('/users/{id}/suspend')
def suspend_user(id: int, _admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    u = _load_non_admin_or_404(db, id, 'suspended')
    if u.deleted_at is not None:
        raise HTTPException(status_code=400, detail='Restore the account before suspending.')
    u.is_active = False
    db.commit()
    return {'ok': True}


@router.patch('/users/{id}/activate')
def activate_user(id: int, _admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    """Reactivate a suspended user. Cannot be used on deleted users — use /restore for those."""
    u = _load_non_admin_or_404(db, id, 'reactivated')
    if u.deleted_at is not None:
        raise HTTPException(status_code=400, detail='User is deleted — restore it first.')
    u.is_active = True
    db.commit()
    return {'ok': True}


@router.delete('/users/{id}')
def delete_user(id: int, _admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    """Soft delete. Sets deleted_at and disables the account. Reversible via /restore."""
    u = _load_non_admin_or_404(db, id, 'deleted')
    if u.deleted_at is None:
        u.deleted_at = datetime.now(timezone.utc)
    u.is_active = False
    db.commit()
    return {'ok': True}


@router.post('/users/{id}/restore')
def restore_user(id: int, _admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    """Restore a soft-deleted user back to active state."""
    u = _load_non_admin_or_404(db, id, 'restored')
    u.deleted_at = None
    u.is_active = True
    db.commit()
    return {'ok': True}


@router.get('/analytics')
def admin_analytics(_admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    total_saloons = db.query(Saloon).count()
    total_users = db.query(User).count()
    bookings_today = db.query(Booking).filter(Booking.booking_date == date.today()).count()
    open_reports = db.query(Report).filter(Report.status == ReportStatus.open).count()
    active_users = db.query(User).filter(User.is_active.is_(True), User.deleted_at.is_(None)).count()
    pending_saloons = db.query(Saloon).filter(Saloon.is_approved.is_(False)).count()
    approved_saloons = db.query(Saloon).filter(Saloon.is_approved.is_(True)).count()
    total_bookings = db.query(Booking).count()

    users_by_role = [
        {'name': role.value, 'value': db.query(User).filter(User.role == role).count()}
        for role in UserRole
    ]
    shops_by_status = [
        {'name': 'Approved', 'value': approved_saloons},
        {'name': 'Pending', 'value': pending_saloons},
    ]
    reports_by_status = [
        {'name': status.value, 'value': db.query(Report).filter(Report.status == status).count()}
        for status in ReportStatus
    ]
    bookings_last_14_days = []
    for i in range(13, -1, -1):
        day = date.today() - timedelta(days=i)
        bookings_last_14_days.append({
            'date': day.isoformat(),
            'bookings': db.query(Booking).filter(Booking.booking_date == day).count(),
        })

    return {
        'total_saloons': total_saloons,
        'total_users': total_users,
        'bookings_today': bookings_today,
        'open_reports': open_reports,
        'active_users': active_users,
        'pending_saloons': pending_saloons,
        'approved_saloons': approved_saloons,
        'total_bookings': total_bookings,
        'users_by_role': users_by_role,
        'shops_by_status': shops_by_status,
        'reports_by_status': reports_by_status,
        'bookings_last_14_days': bookings_last_14_days,
    }


@router.get('/reports')
def admin_reports(
    status: str | None = None,
    q: str | None = None,
    page: int | None = Query(default=None, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_role('admin')),
    db: Session = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    query = db.query(Report).options(selectinload(Report.images))
    if status:
        query = query.filter(Report.status == status)
    if q:
        like = f'%{q.strip()}%'
        conditions = [Report.reason.ilike(like), Report.details.ilike(like)]
        if q.strip().isdigit():
            n = int(q.strip())
            conditions.extend([Report.id == n, Report.saloon_id == n, Report.review_id == n, Report.reporter_id == n])
        query = query.filter(or_(*conditions))
    query = query.order_by(Report.created_at.desc())
    if page is not None:
        return _paginate(query, page, page_size)
    return query.all()


@router.get('/categories', response_model=list[CategoryOut])
def admin_list_categories(_admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.sort_order.asc(), Category.name.asc()).all()


@router.post('/categories', response_model=CategoryOut)
def admin_create_category(payload: CategoryCreate, _admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    slug = (payload.slug or _slugify(payload.name)).strip().lower()
    if db.query(Category).filter(Category.slug == slug).first():
        raise HTTPException(status_code=409, detail='Slug already exists')
    cat = Category(
        name=payload.name.strip(),
        slug=slug,
        description=payload.description,
        icon=payload.icon,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch('/categories/{id}', response_model=CategoryOut)
def admin_update_category(id: int, payload: CategoryUpdate, _admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail='Category not found')
    data = payload.model_dump(exclude_unset=True)
    if 'slug' in data and data['slug']:
        new_slug = data['slug'].strip().lower()
        if new_slug != cat.slug and db.query(Category).filter(Category.slug == new_slug).first():
            raise HTTPException(status_code=409, detail='Slug already exists')
        data['slug'] = new_slug
    for key, value in data.items():
        setattr(cat, key, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete('/categories/{id}')
def admin_delete_category(id: int, _admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail='Category not found')
    db.delete(cat)
    db.commit()
    return {'ok': True}


@router.patch('/reports/{id}/{action}')
def update_report(id: int, action: str, _admin: User = Depends(require_role('admin')), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail='Report not found')
    if action not in {'resolve', 'dismiss'}:
        raise HTTPException(status_code=400, detail='Invalid action')
    report.status = ReportStatus.resolved if action == 'resolve' else ReportStatus.dismissed
    db.commit()
    return {'ok': True}
