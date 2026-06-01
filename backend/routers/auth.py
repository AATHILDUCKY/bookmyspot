import base64
import binascii
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from models import User, UserRole
from schemas import AuthLogin, AuthRegister, ProfileUpdate, ResendOtpIn, TokenPairOut, TokenRefreshIn, UserOut, VerifyOtpIn
from services.notification_service import create_notification
from services.otp_service import issue_otp, verify_otp_code


router = APIRouter(prefix='/auth', tags=['auth'])
AVATAR_MAX_BYTES = 20 * 1024
AVATAR_DIR = Path(__file__).resolve().parents[1] / 'uploads' / 'avatars'


def _save_webp_avatar(user_id: int, data_url: str) -> str:
    prefix = 'data:image/webp;base64,'
    if not data_url.startswith(prefix):
        raise HTTPException(status_code=400, detail='Profile picture must be WebP format')
    try:
        raw = base64.b64decode(data_url[len(prefix):], validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail='Invalid profile picture data')
    if len(raw) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=400, detail='Profile picture must be less than 20KB')

    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    filename = f'user-{user_id}.webp'
    (AVATAR_DIR / filename).write_bytes(raw)
    return f'/static/avatars/{filename}'


@router.post('/register', response_model=UserOut)
def register(payload: AuthRegister, db: Session = Depends(get_db)):
    if payload.role not in {'customer', 'owner', 'admin'}:
        raise HTTPException(status_code=400, detail='Invalid role')
    exists = db.query(User).filter((User.email == payload.email) | (User.phone == payload.phone)).first()
    if exists:
        raise HTTPException(status_code=400, detail='Email or phone already registered')

    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=get_password_hash(payload.password),
        role=UserRole(payload.role),
        city=payload.city,
        district=payload.district,
        province=payload.province,
        address=payload.address,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    email_sent = issue_otp(db, user.email)
    body = 'We sent a verification code to your email.' if email_sent else 'OTP email could not be sent. Check SMTP settings.'
    create_notification(db, user.id, 'Verify your account', body, 'auth')
    return user


@router.post('/verify-otp')
def verify_otp(payload: VerifyOtpIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    verify_otp_code(db, payload.email, payload.code)
    return {'ok': True, 'message': 'Account verified'}


@router.post('/resend-otp')
def resend_otp(payload: ResendOtpIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    email_sent = issue_otp(db, user.email)
    create_notification(db, user.id, 'New OTP code', 'A new OTP code was sent to your email.', 'auth')
    return {'ok': True, 'email_sent': email_sent}


@router.get('/me', response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch('/me', response_model=UserOut)
def update_me(payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.phone and payload.phone != user.phone:
        exists = db.query(User).filter(User.phone == payload.phone, User.id != user.id).first()
        if exists:
            raise HTTPException(status_code=400, detail='Phone number already registered')
        user.phone = payload.phone
    if payload.name:
        user.name = payload.name
    if payload.avatar_data_url:
        user.avatar_url = _save_webp_avatar(user.id, payload.avatar_data_url)
    if payload.city is not None:
        user.city = payload.city
    if payload.district is not None:
        user.district = payload.district
    if payload.province is not None:
        user.province = payload.province
    if payload.address is not None:
        user.address = payload.address

    db.commit()
    db.refresh(user)
    return user


@router.post('/login', response_model=TokenPairOut)
def login(payload: AuthLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')
    if not user.is_active:
        raise HTTPException(status_code=403, detail='User account suspended')

    return {
        'access_token': create_access_token(user.id),
        'refresh_token': create_refresh_token(user.id),
        'user': user,
    }


@router.post('/refresh')
def refresh(payload: TokenRefreshIn, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
        if data.get('type') != 'refresh':
            raise HTTPException(status_code=401, detail='Invalid token type')
        user_id = int(data['sub'])
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail='Invalid refresh token')

    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    return {'access_token': create_access_token(user.id), 'refresh_token': create_refresh_token(user.id)}


@router.post('/logout')
def logout(_user: User = Depends(get_current_user)):
    return {'message': 'Logged out successfully'}
