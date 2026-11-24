from sqlalchemy import Boolean, Column, Integer

from app.db.base import Base


class NotificationSetting(Base):
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True)
    automatic_email = Column(Boolean, nullable=False, default=True)
