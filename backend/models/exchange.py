from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from config.db import Base

class Passenger(Base):
    __tablename__ = 'exchange_passengers'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    pnr_number = Column(String(20), nullable=False, unique=True)
    train_number = Column(String(20), nullable=False)
    coach_number = Column(String(10), nullable=False)
    seat_number = Column(String(10), nullable=False)
    
    requests = relationship("ExchangeRequest", back_populates="passenger")

class ExchangeRequest(Base):
    __tablename__ = 'exchange_requests'

    id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey('exchange_passengers.id'), nullable=False)
    current_seat_type = Column(String(50), nullable=False) # e.g., 'Middle Berth'
    requested_seat_type = Column(String(50), nullable=False) # e.g., 'Lower Berth'
    status = Column(String(20), default='PENDING') # PENDING, MATCHED, COMPLETED, CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow)

    passenger = relationship("Passenger", back_populates="requests")

class ExchangeMatch(Base):
    __tablename__ = 'exchange_matches'

    id = Column(Integer, primary_key=True, index=True)
    request_one_id = Column(Integer, ForeignKey('exchange_requests.id'), nullable=False)
    request_two_id = Column(Integer, ForeignKey('exchange_requests.id'), nullable=False)
    match_score = Column(Float, nullable=False)
    approval_status = Column(String(20), default='PENDING') # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime, default=datetime.utcnow)

    request_one = relationship("ExchangeRequest", foreign_keys=[request_one_id])
    request_two = relationship("ExchangeRequest", foreign_keys=[request_two_id])
