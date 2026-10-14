from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.api.v1.api import api_router
from app.api.v1.endpoints import health
from app.models.user import User


def ensure_sqlite_user_columns():
    if not str(engine.url).startswith("sqlite"):
        return

    columns = {
        "smtp_host": "VARCHAR(255)",
        "smtp_port": "VARCHAR(16)",
        "smtp_username": "VARCHAR(255)",
        "smtp_password": "VARCHAR(255)",
        "smtp_from_email": "VARCHAR(255)",
        "smtp_from_name": "VARCHAR(128)",
        "smtp_use_tls": "BOOLEAN NOT NULL DEFAULT 1",
        "smtp_enabled": "BOOLEAN NOT NULL DEFAULT 0",
    }
    with engine.begin() as connection:
        existing = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(users)").fetchall()}
        for name, definition in columns.items():
            if name not in existing:
                connection.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {name} {definition}")


def ensure_admin_user_exists():
    with engine.begin() as connection:
        user_count = connection.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0
        admin_count = connection.execute(text("SELECT COUNT(*) FROM users WHERE role = 'admin'")).scalar() or 0
        if user_count > 0 and admin_count == 0:
            connection.execute(text(
                "UPDATE users SET role = 'admin' "
                "WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)"
            ))


def ensure_bootstrap_users():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == settings.BOOTSTRAP_ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                email=settings.BOOTSTRAP_ADMIN_EMAIL,
                display_name="System Admin",
                password_hash=hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD),
                role="admin",
                is_active=True,
            )
            db.add(admin)

        user = db.query(User).filter(User.email == settings.BOOTSTRAP_USER_EMAIL).first()
        if not user:
            user = User(
                email=settings.BOOTSTRAP_USER_EMAIL,
                display_name=settings.BOOTSTRAP_USER_NAME,
                password_hash=hash_password(settings.BOOTSTRAP_USER_PASSWORD),
                role="user",
                is_active=True,
            )
            db.add(user)

        user = db.query(User).filter(User.email == settings.BOOTSTRAP_USER_EMAIL).first() or user
        user.display_name = settings.BOOTSTRAP_USER_NAME
        user.role = "user"
        user.smtp_enabled = bool(settings.BOOTSTRAP_USER_SMTP_PASSWORD)
        user.smtp_host = settings.SMTP_HOST or "smtp.gmail.com"
        user.smtp_port = str(settings.SMTP_PORT or 587)
        user.smtp_username = settings.SMTP_USERNAME or settings.BOOTSTRAP_USER_EMAIL
        user.smtp_password = settings.BOOTSTRAP_USER_SMTP_PASSWORD
        user.smtp_from_email = settings.SMTP_FROM_EMAIL or settings.BOOTSTRAP_USER_EMAIL
        user.smtp_from_name = settings.SMTP_FROM_NAME
        user.smtp_use_tls = settings.SMTP_USE_TLS

        db.commit()
    finally:
        db.close()


# Auto-create tables on startup (or when run locally with SQLite)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_user_columns()
    ensure_admin_user_exists()
    ensure_bootstrap_users()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Real-Time Healthcare Decision Support System (RT-HDSS) for patient deterioration early-warning.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root health check endpoint
app.include_router(health.router, tags=["Health"])

# Include v1 API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": "/docs",
        "health_url": "/health",
        "version": "1.0.0"
    }
