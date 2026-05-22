"""
SQLAlchemy models for Smart Seat Selection.
TrainCoach and Seat tables — stored in the same DB as the rest of the app.
"""
from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from config.db import Base


class TrainCoach(Base):
    __tablename__ = 'train_coaches'

    id          = Column(Integer, primary_key=True, autoincrement=True)
    train_number = Column(String(20), nullable=False, index=True)
    coach_name  = Column(String(20), nullable=False)   # e.g. S1, B1, A1
    coach_type  = Column(String(10), nullable=False)   # SL, 3A, 2A, 1A, CC, 2S
    total_seats = Column(Integer, default=72)
    coach_order = Column(Integer, default=1)           # position in train

    seats = relationship('Seat', back_populates='coach',
                         cascade='all, delete-orphan', lazy='select')

    def to_dict(self):
        return {
            'id':           self.id,
            'trainNumber':  self.train_number,
            'coachName':    self.coach_name,
            'coachType':    self.coach_type,
            'totalSeats':   self.total_seats,
            'coachOrder':   self.coach_order,
        }


class Seat(Base):
    __tablename__ = 'seats'

    id            = Column(Integer, primary_key=True, autoincrement=True)
    coach_id      = Column(Integer, ForeignKey('train_coaches.id', ondelete='CASCADE'), nullable=False)
    seat_number   = Column(Integer, nullable=False)
    seat_type     = Column(String(20), nullable=False)  # Lower/Middle/Upper/SideLower/SideUpper/Window
    is_booked     = Column(Boolean, default=False)
    position_x    = Column(Integer, default=0)          # column in coach grid
    position_y    = Column(Integer, default=0)          # row in coach grid
    near_window   = Column(Boolean, default=False)
    near_exit     = Column(Boolean, default=False)
    near_washroom = Column(Boolean, default=False)
    bay_number    = Column(Integer, default=1)          # compartment/bay index

    coach = relationship('TrainCoach', back_populates='seats')

    def to_dict(self):
        return {
            'id':           self.id,
            'coachId':      self.coach_id,
            'seatNumber':   self.seat_number,
            'seatType':     self.seat_type,
            'isBooked':     self.is_booked,
            'positionX':    self.position_x,
            'positionY':    self.position_y,
            'nearWindow':   self.near_window,
            'nearExit':     self.near_exit,
            'nearWashroom': self.near_washroom,
            'bayNumber':    self.bay_number,
        }
