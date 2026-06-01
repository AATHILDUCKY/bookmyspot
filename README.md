# bookmyspot

Full-stack appointment booking app scaffold using Next.js 14 + FastAPI + PostgreSQL.

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Environment (`backend/.env`):

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/book_my_saloon
SECRET_KEY=change-me
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=10080
SENDGRID_API_KEY=
SENDER_EMAIL=noreply@example.com
SMTP_HOST=mail.spacemail.com
SMTP_PORT=465
SMTP_USER=me@example.com
SMTP_PASS=change-me
SMTP_FROM=me@example.com
OTP_EXPIRE_MINUTES=10
```

OTP emails use SMTP first when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are set. SendGrid remains available as a fallback for other emails.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Environment (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## API Coverage

Implemented auth, customer, owner, and admin routes listed in the prompt, plus SSE stream at:

- `GET /notifications/stream`
- `GET /owner/calendar`
- `PATCH /owner/bookings/{id}/move`

## SaaS Optimization

See [`SAAS_OPTIMIZATION_BLUEPRINT.md`](./SAAS_OPTIMIZATION_BLUEPRINT.md) for the production architecture plan covering dashboards, calendar design, PostgreSQL indexes, Prisma migration ideas, Redis queues, Stripe revenue features, notifications, security, SEO, mobile UX, deployment, and scaling.

## Notes

- Current implementation is production-oriented scaffold with working CRUD/query flow.
- Add Alembic migration scripts and full shadcn component generation in next pass.
- For existing databases, create a migration for the new composite indexes instead of relying on `create_all`.
