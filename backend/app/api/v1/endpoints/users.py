from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.core.security import hash_password

router = APIRouter()


@router.get("", response_model=List[UserResponse])
def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all registered clinician users."""
    return db.query(User).offset(skip).limit(limit).all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new clinician user with notification preferences (email, mobile, name)."""
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        # Update user's name or phone number if already exists
        existing.display_name = user_in.display_name or existing.display_name
        existing.phone_number = user_in.phone_number or existing.phone_number
        existing.role = user_in.role or existing.role
        db.commit()
        db.refresh(existing)
        return existing

    user = User(
        email=user_in.email,
        display_name=user_in.display_name or user_in.email.split("@")[0].title(),
        phone_number=user_in.phone_number,
        password_hash=hash_password(user_in.password or "HospitalSecure2026!"),
        role=user_in.role,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
