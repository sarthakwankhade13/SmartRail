"""
SQLAlchemy models for the Journey Planner feature.
Train — stores train metadata.
Stop  — stores intermediate stops with halt/arrival/departure info.
"""
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from config.db import Base


class Train(Base):
    __tablename__ = 'journey_trains'

    id = Column(Integer, primary_key=True, autoincrement=True)
    train_name = Column(String(120), nullable=False)
    train_number = Column(String(10), nullable=False, unique=True)
    source = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    departure_time = Column(String(10), nullable=False)
    arrival_time = Column(String(10), nullable=False)
    duration = Column(String(20), nullable=False)
    platform = Column(Integer, nullable=False, default=1)
    train_type = Column(String(30), nullable=False)
    seat_availability = Column(String(30), nullable=False, default='Available')

    stops = relationship('Stop', back_populates='train', cascade='all, delete-orphan',
                         order_by='Stop.stop_order')

    def to_dict(self, include_stops=False):
        data = {
            'id': self.id,
            'trainName': self.train_name,
            'trainNumber': self.train_number,
            'source': self.source,
            'destination': self.destination,
            'departureTime': self.departure_time,
            'arrivalTime': self.arrival_time,
            'duration': self.duration,
            'platform': self.platform,
            'trainType': self.train_type,
            'seatAvailability': self.seat_availability,
        }
        if include_stops:
            data['stops'] = [s.to_dict() for s in self.stops]
        return data


class Stop(Base):
    __tablename__ = 'journey_stops'

    id = Column(Integer, primary_key=True, autoincrement=True)
    train_id = Column(Integer, ForeignKey('journey_trains.id', ondelete='CASCADE'), nullable=False)
    station_name = Column(String(100), nullable=False)
    halt_time = Column(String(10), nullable=True)
    arrival = Column(String(10), nullable=True)
    departure = Column(String(10), nullable=True)
    stop_order = Column(Integer, nullable=False, default=0)

    train = relationship('Train', back_populates='stops')

    def to_dict(self):
        return {
            'id': self.id,
            'stationName': self.station_name,
            'haltTime': self.halt_time,
            'arrival': self.arrival,
            'departure': self.departure,
            'stopOrder': self.stop_order,
        }
