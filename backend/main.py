from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from core.config import settings
from core.database import SessionLocal, engine, ensure_database_exists
from core.security import get_password_hash
from models import Base, User, UserRole
from routers.admin import router as admin_router
from routers.auth import router as auth_router
from routers.bookings import router as bookings_router
from routers.categories import router as categories_router, seed_default_categories
from routers.owner import router as owner_router
from routers.saloons import router as saloons_router


UPLOAD_DIR = Path(__file__).resolve().parent / 'uploads'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth_router)
app.include_router(saloons_router)
app.include_router(bookings_router)
app.include_router(owner_router)
app.include_router(admin_router)
app.include_router(categories_router)
app.mount('/static', StaticFiles(directory=UPLOAD_DIR), name='static')


@app.on_event('startup')
def initialize_database():
    ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        driver = engine.url.drivername
        if driver.startswith('postgresql'):
            conn.execute(text('ALTER TABLE saloons ALTER COLUMN cover_image TYPE TEXT'))
            conn.execute(text('ALTER TABLE saloon_images ALTER COLUMN url TYPE TEXT'))
            conn.execute(text('ALTER TABLE staff ALTER COLUMN avatar_url TYPE TEXT'))
            conn.execute(text('ALTER TABLE users ALTER COLUMN phone DROP NOT NULL'))
            conn.execute(text("ALTER TABLE saloons ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT TRUE"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(40)"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id INTEGER"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(255)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ"))
        elif driver.startswith('sqlite'):
            saloon_cols = {row[1] for row in conn.execute(text("PRAGMA table_info('saloons')")).fetchall()}
            if 'is_open' not in saloon_cols:
                conn.execute(text("ALTER TABLE saloons ADD COLUMN is_open BOOLEAN NOT NULL DEFAULT 1"))
            notif_cols = {row[1] for row in conn.execute(text("PRAGMA table_info('notifications')")).fetchall()}
            for col, decl in (('entity_type', 'VARCHAR(40)'), ('entity_id', 'INTEGER'), ('link', 'VARCHAR(255)')):
                if col not in notif_cols:
                    conn.execute(text(f"ALTER TABLE notifications ADD COLUMN {col} {decl}"))
            user_cols = {row[1] for row in conn.execute(text("PRAGMA table_info('users')")).fetchall()}
            if 'deleted_at' not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP"))

        # Indexes added after initial release. create_all won't add an index
        # to a pre-existing table, so do it explicitly; both Postgres and
        # SQLite support IF NOT EXISTS here.
        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_saloons_lat_lng ON saloons (lat, lng)'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_services_name ON services (name)'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_reviews_saloon_recent ON reviews (saloon_id, created_at)'))

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == settings.admin_email).first()
        if not admin:
            admin = User(
                name=settings.admin_name,
                email=settings.admin_email,
                phone=settings.admin_phone,
                hashed_password=get_password_hash(settings.admin_password),
                role=UserRole.admin,
                is_active=True,
            )
            db.add(admin)
            db.commit()
        seed_default_categories(db)
    finally:
        db.close()


@app.get('/health')
def health():
    return {'ok': True}
