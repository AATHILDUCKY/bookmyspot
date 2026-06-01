from datetime import date
from math import asin, cos, radians, sin, sqrt, fabs

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload, selectinload

from core.database import get_db
from models import Booking, Category, Favourite, Review, Saloon, SaloonCategory, Service, User
from schemas import SaloonDetailOut, SaloonListOut, SaloonNearbyOut, SaloonReviewsOut, SuggestOut
from services.availability_service import get_available_slots


router = APIRouter(tags=['saloons'])


@router.get('/saloons', response_model=list[SaloonListOut])
def list_saloons(
    search: str | None = Query(default=None, alias='q'),
    city: str | None = None,
    service: str | None = None,
    category: str | None = Query(default=None, description='Comma-separated category slugs'),
    rating: float | None = None,
    lat: float | None = None,
    lng: float | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    max_distance_km: float | None = Query(default=None, ge=0.1, le=500),
    sort: str = Query(default='rating'),
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    rating_subquery = db.query(
        Review.saloon_id.label('saloon_id'),
        func.coalesce(func.avg(Review.rating), 0).label('avg_rating'),
    ).group_by(Review.saloon_id).subquery()

    followers_subquery = db.query(
        Favourite.saloon_id.label('saloon_id'),
        func.count(Favourite.customer_id).label('followers_count'),
    ).group_by(Favourite.saloon_id).subquery()

    query = (
        db.query(
            Saloon,
            func.coalesce(rating_subquery.c.avg_rating, 0).label('avg_rating'),
            func.coalesce(followers_subquery.c.followers_count, 0).label('followers_count'),
        )
        .outerjoin(rating_subquery, rating_subquery.c.saloon_id == Saloon.id)
        .outerjoin(followers_subquery, followers_subquery.c.saloon_id == Saloon.id)
        .options(selectinload(Saloon.services), selectinload(Saloon.categories))
        .filter(Saloon.is_approved.is_(True), Saloon.is_active.is_(True))
    )
    if category:
        slugs = [s.strip().lower() for s in category.split(',') if s.strip()]
        if slugs:
            query = query.filter(
                Saloon.id.in_(
                    db.query(SaloonCategory.saloon_id)
                    .join(Category, Category.id == SaloonCategory.category_id)
                    .filter(Category.slug.in_(slugs), Category.is_active.is_(True))
                )
            )
    if city:
        query = query.filter(Saloon.city.ilike(f'%{city}%'))
    if search:
        query = query.filter(
            (Saloon.name.ilike(f'%{search}%'))
            | (Saloon.city.ilike(f'%{search}%'))
            | (Saloon.address.ilike(f'%{search}%'))
        )
    if service:
        query = query.filter(Saloon.services.any(Service.name.ilike(f'%{service}%')))
    if min_price is not None or max_price is not None:
        price_filters = []
        if min_price is not None:
            price_filters.append(Service.price >= min_price)
        if max_price is not None:
            price_filters.append(Service.price <= max_price)
        query = query.filter(Saloon.services.any(and_(*price_filters)))
    if rating:
        query = query.filter(func.coalesce(rating_subquery.c.avg_rating, 0) >= rating)

    # ── Spatial pre-filter ──────────────────────────────────────────────
    # Convert a radius in km to a lat/lng bounding box so the database can
    # skip rows that are obviously out of range BEFORE we do trig in Python.
    #   1° latitude  ≈ 111 km everywhere.
    #   1° longitude ≈ 111 km * cos(lat). At lat=0 → 111km, at lat=80 → 19km.
    # This is O(1) per row at the SQL level using btree comparison; on a few
    # hundred to thousand rows it brings the candidate set from N to ~k
    # before we run Haversine on the survivors. Indexes on (lat, lng) help.
    if max_distance_km is not None and lat is not None and lng is not None:
        d_lat = max_distance_km / 111.0
        cos_lat = cos(radians(lat))
        d_lng = max_distance_km / (111.0 * max(cos_lat, 0.01))
        query = query.filter(
            Saloon.lat.isnot(None),
            Saloon.lng.isnot(None),
            Saloon.lat.between(lat - d_lat, lat + d_lat),
            Saloon.lng.between(lng - d_lng, lng + d_lng),
        )

    if sort == 'distance' and lat is not None and lng is not None:
        query = query.order_by(Saloon.created_at.desc())
    elif sort == 'rating':
        query = query.order_by(func.coalesce(rating_subquery.c.avg_rating, 0).desc(), Saloon.created_at.desc())
    else:
        query = query.order_by(Saloon.created_at.desc())

    rows = query.offset((page - 1) * limit).limit(limit).all()
    items = []
    for saloon, avg_rating, followers_count in rows:
        distance_km = None
        if lat is not None and lng is not None and saloon.lat is not None and saloon.lng is not None:
            earth_radius_km = 6371
            dlat = radians(saloon.lat - lat)
            dlng = radians(saloon.lng - lng)
            a = sin(dlat / 2) ** 2 + cos(radians(lat)) * cos(radians(saloon.lat)) * sin(dlng / 2) ** 2
            distance_km = round(2 * earth_radius_km * asin(sqrt(a)), 2)

        active_services = [service for service in saloon.services if service.is_active]
        prices = [float(service.price) for service in active_services]
        items.append(
            {
                **saloon.__dict__,
                'categories': list(saloon.categories),
                'avg_rating': round(float(avg_rating or 0), 2),
                'followers_count': int(followers_count or 0),
                'top_services': [service.name for service in active_services[:3]],
                'distance_km': distance_km,
                'min_price': min(prices) if prices else None,
            }
        )

    # Exact post-filter on Haversine distance (bounding box was just a fast cull;
    # box corners are √2 farther than the true radius, so anything that survived
    # might still be outside the circle — verify here).
    if max_distance_km is not None and lat is not None and lng is not None:
        items = [
            it for it in items
            if it['distance_km'] is not None and it['distance_km'] <= max_distance_km
        ]

    if sort == 'distance' and lat is not None and lng is not None:
        items.sort(key=lambda item: item['distance_km'] if item['distance_km'] is not None else 999999)
    return items


def _rank(labels, q_lower, key=lambda x: x):
    """Cheap relevance sort: whole-string prefix, then word prefix, then the
    rest — ties broken by shorter (closer) match, then alphabetically. Runs in
    Python on a handful of already-filtered rows, so it's effectively free."""
    def score(item):
        label = key(item).lower()
        if label.startswith(q_lower):
            rank = 0
        elif any(word.startswith(q_lower) for word in label.split()):
            rank = 1
        else:
            rank = 2
        return (rank, len(label), label)
    return sorted(labels, key=score)


@router.get('/saloons/suggest', response_model=SuggestOut)
def suggest(
    q: str = Query(..., min_length=1, max_length=80),
    db: Session = Depends(get_db),
):
    """Type-ahead suggestions across shops, services, categories and cities.

    Kept fast and low-cost by design:
      · Each entity runs one narrow, LIMIT-ed query (≤ ~20 rows).
      · `name LIKE 'q%'` is index-friendly; we also accept `'% q%'` to match
        the start of any word ("col" → "Royal **Col**ombo"), which stays cheap
        on small candidate sets.
      · Final ranking is done in Python over those few rows — no expensive
        SQL sorting or full-text scan.
    """
    term = q.strip()
    if len(term) < 2:
        # One character is too noisy to rank usefully; let the box stay quiet.
        return SuggestOut()

    like_prefix = f'{term}%'
    like_word = f'% {term}%'
    like_any = f'%{term}%'
    q_lower = term.lower()
    visible = (Saloon.is_approved.is_(True), Saloon.is_active.is_(True))

    # ── Categories (small table — fetch matches, rank, slice) ────────────
    cat_rows = (
        db.query(Category)
        .filter(Category.is_active.is_(True))
        .filter(Category.name.ilike(like_prefix) | Category.name.ilike(like_word))
        .limit(20)
        .all()
    )
    categories = [
        {'name': c.name, 'slug': c.slug, 'icon': c.icon}
        for c in _rank(cat_rows, q_lower, key=lambda c: c.name)[:5]
    ]

    # ── Shops (prefix/word-prefix on name, only visible) ─────────────────
    shop_rows = (
        db.query(Saloon.id, Saloon.name, Saloon.city)
        .filter(*visible)
        .filter(Saloon.name.ilike(like_prefix) | Saloon.name.ilike(like_word))
        .limit(20)
        .all()
    )
    shops = [
        {'id': r.id, 'name': r.name, 'city': r.city}
        for r in _rank(shop_rows, q_lower, key=lambda r: r.name)[:6]
    ]

    # ── Services (distinct names offered by visible, active shops) ───────
    svc_rows = (
        db.query(Service.name)
        .join(Saloon, Saloon.id == Service.saloon_id)
        .filter(*visible, Service.is_active.is_(True))
        .filter(Service.name.ilike(like_any))
        .distinct()
        .limit(25)
        .all()
    )
    services = _rank([r.name for r in svc_rows], q_lower)[:6]

    # ── Cities (distinct, prefix only — short tokens) ────────────────────
    city_rows = (
        db.query(Saloon.city)
        .filter(*visible)
        .filter(Saloon.city.ilike(like_prefix))
        .distinct()
        .limit(15)
        .all()
    )
    cities = _rank([r.city for r in city_rows], q_lower)[:4]

    return SuggestOut(shops=shops, services=services, categories=categories, cities=cities)


@router.get('/saloons/nearby', response_model=list[SaloonNearbyOut])
def nearby_saloons(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(default=5, ge=0.5, le=50),
    category: str | None = Query(default=None, description='Comma-separated category slugs'),
    q: str | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """All visible shops within `radius_km` of (lat, lng), nearest first.

    Two-stage geo-search — cheap cull, then exact verify:

      1. Bounding-box pre-filter in SQL. A km radius is converted to lat/lng
         degree deltas, so the DB rejects far rows with plain btree range
         comparisons (index `ix_saloons_lat_lng`) — no trigonometry per row.
           · 1° latitude  ≈ 111 km everywhere.
           · 1° longitude ≈ 111 km · cos(lat)  (meridians converge polewards).

      2. Exact Haversine post-filter in Python on the handful of survivors.
         The box's corner sits √2·radius from centre, so the box is a superset
         of the circle; this step trims the corners back to a true radius.

    Cost is O(log n) index seek + O(k) over the small in-box candidate set k,
    never O(n) trig over the whole table. Unpaginated by design (a map shows
    every pin) but hard-capped at `limit` for safety.
    """
    rating_subquery = db.query(
        Review.saloon_id.label('saloon_id'),
        func.coalesce(func.avg(Review.rating), 0).label('avg_rating'),
    ).group_by(Review.saloon_id).subquery()

    price_subquery = db.query(
        Service.saloon_id.label('saloon_id'),
        func.min(Service.price).label('min_price'),
    ).filter(Service.is_active.is_(True)).group_by(Service.saloon_id).subquery()

    # ── Stage 1: bounding box (index-assisted, no trig) ──────────────────
    d_lat = radius_km / 111.0
    cos_lat = cos(radians(lat))
    d_lng = radius_km / (111.0 * max(cos_lat, 0.01))

    query = (
        db.query(
            Saloon,
            func.coalesce(rating_subquery.c.avg_rating, 0).label('avg_rating'),
            price_subquery.c.min_price.label('min_price'),
        )
        .outerjoin(rating_subquery, rating_subquery.c.saloon_id == Saloon.id)
        .outerjoin(price_subquery, price_subquery.c.saloon_id == Saloon.id)
        .filter(
            Saloon.is_approved.is_(True),
            Saloon.is_active.is_(True),
            Saloon.lat.isnot(None),
            Saloon.lng.isnot(None),
            Saloon.lat.between(lat - d_lat, lat + d_lat),
            Saloon.lng.between(lng - d_lng, lng + d_lng),
        )
    )

    if category:
        slugs = [s.strip().lower() for s in category.split(',') if s.strip()]
        if slugs:
            query = query.filter(
                Saloon.id.in_(
                    db.query(SaloonCategory.saloon_id)
                    .join(Category, Category.id == SaloonCategory.category_id)
                    .filter(Category.slug.in_(slugs), Category.is_active.is_(True))
                )
            )
    if q:
        query = query.filter(
            (Saloon.name.ilike(f'%{q}%'))
            | (Saloon.city.ilike(f'%{q}%'))
            | (Saloon.address.ilike(f'%{q}%'))
        )

    # The box geographically bounds the result; the 2000 ceiling only guards
    # against a pathologically dense city before we run Haversine.
    rows = query.limit(2000).all()

    # ── Stage 2: exact Haversine, keep ≤ radius, nearest first ───────────
    earth_radius_km = 6371
    items = []
    for saloon, avg_rating, min_price in rows:
        dlat = radians(saloon.lat - lat)
        dlng = radians(saloon.lng - lng)
        a = sin(dlat / 2) ** 2 + cos(radians(lat)) * cos(radians(saloon.lat)) * sin(dlng / 2) ** 2
        distance_km = 2 * earth_radius_km * asin(sqrt(a))
        if distance_km > radius_km:
            continue
        items.append({
            'id': saloon.id,
            'name': saloon.name,
            'city': saloon.city,
            'address': saloon.address,
            'lat': saloon.lat,
            'lng': saloon.lng,
            'cover_image': saloon.cover_image,
            'is_open': saloon.is_open,
            'avg_rating': round(float(avg_rating or 0), 2),
            'min_price': min_price,
            'distance_km': round(distance_km, 2),
        })

    items.sort(key=lambda it: it['distance_km'])
    return items[:limit]


@router.get('/saloons/{id}', response_model=SaloonDetailOut)
def saloon_detail(id: int, db: Session = Depends(get_db)):
    saloon = (
        db.query(Saloon)
        .options(
            joinedload(Saloon.images),
            joinedload(Saloon.services),
            joinedload(Saloon.staff),
            selectinload(Saloon.categories),
        )
        .filter(Saloon.id == id, Saloon.is_active.is_(True))
        .first()
    )
    if not saloon:
        raise HTTPException(status_code=404, detail='Saloon not found')

    # Aggregate rating in one pass; reviews themselves are paginated separately
    # via /saloons/{id}/reviews so we never load the whole list here.
    avg, reviews_count = db.query(
        func.coalesce(func.avg(Review.rating), 0),
        func.count(Review.id),
    ).filter(Review.saloon_id == id).one()
    followers_count = db.query(func.count(Favourite.customer_id)).filter(Favourite.saloon_id == id).scalar() or 0
    return {
        **saloon.__dict__,
        'categories': list(saloon.categories),
        'avg_rating': round(float(avg), 2),
        'reviews_count': int(reviews_count),
        'followers_count': int(followers_count),
    }


@router.get('/saloons/{id}/reviews', response_model=SaloonReviewsOut)
def saloon_reviews(
    id: int,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """Paginated reviews + rating summary for one shop.

    Efficient by construction:
      · Summary is two cheap aggregates — `avg`/`count` in one query and a
        `GROUP BY rating` (≤ 5 rows) for the star distribution.
      · The list itself is a single indexed page (`ix_reviews_saloon_recent`,
        newest first) of just `limit` rows — never the whole history. The UI
        shows 5 and fetches the next 5 on demand.
    """
    if not db.query(Saloon.id).filter(Saloon.id == id).first():
        raise HTTPException(status_code=404, detail='Saloon not found')

    avg, count = db.query(
        func.coalesce(func.avg(Review.rating), 0),
        func.count(Review.id),
    ).filter(Review.saloon_id == id).one()

    dist_rows = (
        db.query(Review.rating, func.count(Review.id))
        .filter(Review.saloon_id == id)
        .group_by(Review.rating)
        .all()
    )
    distribution = {star: 0 for star in range(1, 6)}
    for star, n in dist_rows:
        distribution[int(star)] = int(n)

    rows = (
        db.query(Review, User.name, Service.name)
        .join(User, User.id == Review.customer_id)
        .join(Booking, Booking.id == Review.booking_id)
        .join(Service, Service.id == Booking.service_id)
        .filter(Review.saloon_id == id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    reviews = [
        {
            'id': r.id,
            'rating': r.rating,
            'comment': r.comment,
            'created_at': r.created_at,
            'customer_name': customer_name,
            'service_name': service_name,
        }
        for r, customer_name, service_name in rows
    ]

    return {
        'summary': {'average': round(float(avg), 2), 'count': int(count), 'distribution': distribution},
        'reviews': reviews,
        'page': page,
        'limit': limit,
        'has_more': int(count) > page * limit,
    }


@router.get('/saloons/{id}/availability')
def saloon_availability(id: int, date: date, service_id: int, staff_id: int | None = None, db: Session = Depends(get_db)):
    slots = get_available_slots(db, id, date, service_id, staff_id)
    return {'slots': slots}
