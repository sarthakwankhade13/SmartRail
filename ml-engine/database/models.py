from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .connection import Base

class Train(Base):
    __tablename__ = 'trains'
    train_number = Column(String(10), primary_key=True, index=True)
    train_name = Column(String(100), nullable=False)
    source_station = Column(String(10), nullable=False, index=True)
    destination_station = Column(String(10), nullable=False, index=True)
    distance_km = Column(Integer, nullable=False)
    total_seats_sl = Column(Integer, default=500)
    total_seats_3a = Column(Integer, default=200)
    total_seats_2a = Column(Integer, default=150)
    total_seats_1a = Column(Integer, default=50)
    total_seats_cc = Column(Integer, default=70)
    coach_count = Column(Integer, default=20)
    avg_delay_minutes = Column(Float, default=0.0)
    route_popularity = Column(Integer, default=50)
    created_at = Column(DateTime, default=datetime.utcnow)

    bookings = relationship("BookingHistory", back_populates="train")

class BookingHistory(Base):
    __tablename__ = 'booking_history'
    id = Column(Integer, primary_key=True, autoincrement=True)
    train_number = Column(String(10), ForeignKey('trains.train_number'), index=True)
    journey_date = Column(Date, nullable=False, index=True)
    booking_date = Column(Date, nullable=False)
    class_type = Column(String(5), nullable=False, index=True)
    quota = Column(String(10), nullable=False)
    waitlist_position = Column(Integer, nullable=False)
    rac_count = Column(Integer, default=0)
    passenger_count = Column(Integer, default=1)
    age_group = Column(String(10))
    final_status = Column(String(15), nullable=False, index=True)
    confirmation_probability = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    train = relationship("Train", back_populates="bookings")

class PredictionLog(Base):
    __tablename__ = 'prediction_logs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    train_number = Column(String(10), index=True)
    journey_date = Column(Date, index=True)
    class_type = Column(String(5))
    quota = Column(String(10))
    waitlist_position = Column(Integer)
    predicted_probability = Column(Float, nullable=False)
    predicted_rac_probability = Column(Float)
    predicted_risk_level = Column(String(10))
    confidence_score = Column(Float)
    model_version = Column(String(50), default='v1.0')
    shap_top_feature = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class HistoricalTrend(Base):
    __tablename__ = 'historical_trends'
    id = Column(Integer, primary_key=True, autoincrement=True)
    train_number = Column(String(10), ForeignKey('trains.train_number'), index=True)
    record_date = Column(Date, nullable=False, index=True)
    occupancy_rate = Column(Float)
    cancellation_rate = Column(Float)
    booking_velocity = Column(Float)
    demand_index = Column(Float)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SeasonalAnalytics(Base):
    __tablename__ = 'seasonal_analytics'
    id = Column(Integer, primary_key=True, autoincrement=True)
    season = Column(String(15), nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    is_festival = Column(Boolean, default=False)
    is_holiday = Column(Boolean, default=False)
    avg_occupancy = Column(Float)
    avg_cancellation = Column(Float)
    avg_confirmation_rate = Column(Float)
    peak_demand_score = Column(Float)

class SeatMovementLog(Base):
    __tablename__ = 'seat_movement_logs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    train_number = Column(String(10), ForeignKey('trains.train_number'), index=True)
    journey_date = Column(Date, nullable=False, index=True)
    class_type = Column(String(5), nullable=False)
    hours_before_departure = Column(Integer, nullable=False)
    waitlist_count = Column(Integer, default=0)
    rac_count = Column(Integer, default=0)
    confirmed_count = Column(Integer, default=0)
    recorded_at = Column(DateTime, default=datetime.utcnow)
