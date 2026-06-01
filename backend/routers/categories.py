from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from models import Category
from schemas import CategoryOut


router = APIRouter(tags=['categories'])


@router.get('/categories', response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return (
        db.query(Category)
        .filter(Category.is_active.is_(True))
        .order_by(Category.sort_order.asc(), Category.name.asc())
        .all()
    )


DEFAULT_CATEGORIES = [
    {'name': 'Salon',            'slug': 'salon',       'description': 'Hair, colour, styling',     'icon': 'scissors',   'sort_order': 10},
    {'name': 'Barber',           'slug': 'barber',      'description': 'Haircut, shave, beard',     'icon': 'razor',      'sort_order': 20},
    {'name': 'Spa & Wellness',   'slug': 'spa',         'description': 'Massage, facials, wraps',   'icon': 'sparkles',   'sort_order': 30},
    {'name': 'Nail Studio',      'slug': 'nails',       'description': 'Manicure, pedicure, art',   'icon': 'hand',       'sort_order': 40},
    {'name': 'Lash & Brow Bar',  'slug': 'lash-brow',   'description': 'Extensions, threading',     'icon': 'eye',        'sort_order': 50},
    {'name': 'Skin Clinic',      'slug': 'skin-clinic', 'description': 'Laser, peels, acne care',   'icon': 'syringe',    'sort_order': 60},
    {'name': 'Makeup Artist',    'slug': 'makeup',      'description': 'Bridal, events, shoots',    'icon': 'palette',    'sort_order': 70},
    {'name': 'Tattoo & Piercing','slug': 'tattoo',      'description': 'Studio bookings',           'icon': 'pen-tool',   'sort_order': 80},
]


def seed_default_categories(db: Session) -> None:
    existing = {c.slug for c in db.query(Category.slug).all()}
    added = False
    for entry in DEFAULT_CATEGORIES:
        if entry['slug'] in existing:
            continue
        db.add(Category(**entry, is_active=True))
        added = True
    if added:
        db.commit()
