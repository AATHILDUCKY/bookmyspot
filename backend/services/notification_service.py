import smtplib
from email.message import EmailMessage

from sqlalchemy.orm import Session
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from core.config import settings
from models import Notification


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    ntype: str = 'info',
    entity_type: str | None = None,
    entity_id: int | None = None,
    link: str | None = None,
) -> Notification:
    n = Notification(
        user_id=user_id,
        title=title,
        body=body,
        type=ntype,
        entity_type=entity_type,
        entity_id=entity_id,
        link=link,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def send_email(to_email: str, subject: str, body: str) -> bool:
    if settings.smtp_host and settings.smtp_user and settings.smtp_pass:
        message = EmailMessage()
        message['Subject'] = subject
        message['From'] = settings.smtp_from or settings.smtp_user
        message['To'] = to_email
        message.set_content(body)

        try:
            if settings.smtp_port == 465:
                with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                    smtp.login(settings.smtp_user, settings.smtp_pass)
                    smtp.send_message(message)
            else:
                with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                    smtp.starttls()
                    smtp.login(settings.smtp_user, settings.smtp_pass)
                    smtp.send_message(message)
            return True
        except Exception:
            return False

    if not settings.sendgrid_api_key:
        return False
    message = Mail(from_email=settings.sender_email, to_emails=to_email, subject=subject, plain_text_content=body)
    try:
        SendGridAPIClient(settings.sendgrid_api_key).send(message)
        return True
    except Exception:
        return False
