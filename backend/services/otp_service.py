from datetime import datetime, timedelta, timezone
from secrets import randbelow

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.config import settings
from models import OtpCode
from services.notification_service import send_email


def create_otp(db: Session, email: str, purpose: str = 'registration') -> OtpCode:
    code = f'{randbelow(1_000_000):06d}'
    otp = OtpCode(
        email=email,
        code=code,
        purpose=purpose,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expire_minutes),
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)
    return otp


def send_otp_email(email: str, code: str) -> bool:
    return send_email(
        email,
        'Your bookmyspot OTP code',
        f'Your bookmyspot verification code is {code}. It expires in {settings.otp_expire_minutes} minutes.',
    )


def issue_otp(db: Session, email: str, purpose: str = 'registration') -> bool:
    otp = create_otp(db, email=email, purpose=purpose)
    return send_otp_email(email, otp.code)


def verify_otp_code(db: Session, email: str, code: str, purpose: str = 'registration') -> None:
    otp = (
        db.query(OtpCode)
        .filter(OtpCode.email == email, OtpCode.purpose == purpose, OtpCode.consumed_at.is_(None))
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status_code=400, detail='No active OTP code found')

    now = datetime.now(timezone.utc)
    expires_at = otp.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        raise HTTPException(status_code=400, detail='OTP code has expired')
    if otp.code != code:
        raise HTTPException(status_code=400, detail='Invalid OTP code')

    otp.consumed_at = now
    db.commit()
