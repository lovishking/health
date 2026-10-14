from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, SmtpSettingsUpdate, TokenResponse
from app.core.security import create_access_token, get_current_user, hash_password, require_admin, verify_password

router = APIRouter()


@router.get("", response_model=List[UserResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin-only: list all registered users and their notification configuration."""
    return db.query(User).offset(skip).limit(limit).all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new user. The first registered user becomes admin."""
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user_count = db.query(User).count()
    role = "admin" if user_count == 0 else user_in.role
    if role not in ["admin", "user"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role must be 'admin' or 'user'")

    user = User(
        email=user_in.email,
        display_name=user_in.display_name or user_in.email.split("@")[0].title(),
        phone_number=user_in.phone_number,
        password_hash=hash_password(user_in.password),
        role=role,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login_user(login_in: UserLogin, db: Session = Depends(get_db)):
    """Authenticate a user and return a bearer token."""
    user = db.query(User).filter(User.email == login_in.email, User.is_active.is_(True)).first()
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return TokenResponse(access_token=create_access_token(user))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile and notification configuration."""
    return current_user


@router.put("/me/smtp", response_model=UserResponse)
def update_my_smtp_settings(
    smtp_in: SmtpSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save SMTP settings used to email this user on critical alerts."""
    current_user.smtp_host = smtp_in.smtp_host
    current_user.smtp_port = str(smtp_in.smtp_port)
    current_user.smtp_username = smtp_in.smtp_username
    current_user.smtp_password = smtp_in.smtp_password
    current_user.smtp_from_email = smtp_in.smtp_from_email
    current_user.smtp_from_name = smtp_in.smtp_from_name
    current_user.smtp_use_tls = smtp_in.smtp_use_tls
    current_user.smtp_enabled = smtp_in.smtp_enabled
    db.commit()
    db.refresh(current_user)
    return current_user
