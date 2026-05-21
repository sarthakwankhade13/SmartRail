"""
Seed script for Journey Planner feature.
Populates the MySQL database with 10 sample Indian trains and their stops.
Run: python scripts/seed_journey.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config.db import engine, SessionLocal, Base
from models.train import Train, Stop


TRAINS_DATA = [
    {
        "train_name": "Rajdhani Express",
        "train_number": "12301",
        "source": "New Delhi",
        "destination": "Howrah",
        "departure_time": "16:55",
        "arrival_time": "09:55",
        "duration": "17h 00m",
        "platform": 3,
        "train_type": "Rajdhani",
        "seat_availability": "Available",
        "stops": [
            {"station_name": "New Delhi", "arrival": None, "departure": "16:55", "halt_time": None, "stop_order": 1},
            {"station_name": "Kanpur Central", "arrival": "21:15", "departure": "21:25", "halt_time": "10 min", "stop_order": 2},
            {"station_name": "Allahabad Jn", "arrival": "23:10", "departure": "23:20", "halt_time": "10 min", "stop_order": 3},
            {"station_name": "Mughal Sarai", "arrival": "00:45", "departure": "00:55", "halt_time": "10 min", "stop_order": 4},
            {"station_name": "Gaya Jn", "arrival": "03:05", "departure": "03:07", "halt_time": "2 min", "stop_order": 5},
            {"station_name": "Dhanbad Jn", "arrival": "05:35", "departure": "05:40", "halt_time": "5 min", "stop_order": 6},
            {"station_name": "Asansol Jn", "arrival": "06:50", "departure": "06:52", "halt_time": "2 min", "stop_order": 7},
            {"station_name": "Howrah Jn", "arrival": "09:55", "departure": None, "halt_time": None, "stop_order": 8},
        ]
    },
    {
        "train_name": "Shatabdi Express",
        "train_number": "12002",
        "source": "New Delhi",
        "destination": "Bhopal",
        "departure_time": "06:15",
        "arrival_time": "14:30",
        "duration": "8h 15m",
        "platform": 1,
        "train_type": "Shatabdi",
        "seat_availability": "Available",
        "stops": [
            {"station_name": "New Delhi", "arrival": None, "departure": "06:15", "halt_time": None, "stop_order": 1},
            {"station_name": "Agra Cantt", "arrival": "08:12", "departure": "08:17", "halt_time": "5 min", "stop_order": 2},
            {"station_name": "Gwalior Jn", "arrival": "09:40", "departure": "09:42", "halt_time": "2 min", "stop_order": 3},
            {"station_name": "Jhansi Jn", "arrival": "10:55", "departure": "11:00", "halt_time": "5 min", "stop_order": 4},
            {"station_name": "Bhopal Jn", "arrival": "14:30", "departure": None, "halt_time": None, "stop_order": 5},
        ]
    },
    {
        "train_name": "Duronto Express",
        "train_number": "12213",
        "source": "Mumbai CST",
        "destination": "New Delhi",
        "departure_time": "23:05",
        "arrival_time": "15:55",
        "duration": "16h 50m",
        "platform": 5,
        "train_type": "Duronto",
        "seat_availability": "RAC",
        "stops": [
            {"station_name": "Mumbai CST", "arrival": None, "departure": "23:05", "halt_time": None, "stop_order": 1},
            {"station_name": "Borivali", "arrival": "23:42", "departure": "23:44", "halt_time": "2 min", "stop_order": 2},
            {"station_name": "Surat", "arrival": "03:05", "departure": "03:07", "halt_time": "2 min", "stop_order": 3},
            {"station_name": "Vadodara Jn", "arrival": "04:40", "departure": "04:45", "halt_time": "5 min", "stop_order": 4},
            {"station_name": "Ratlam Jn", "arrival": "08:15", "departure": "08:20", "halt_time": "5 min", "stop_order": 5},
            {"station_name": "Kota Jn", "arrival": "11:10", "departure": "11:15", "halt_time": "5 min", "stop_order": 6},
            {"station_name": "H Nizamuddin", "arrival": "15:55", "departure": None, "halt_time": None, "stop_order": 7},
        ]
    },
    {
        "train_name": "Garib Rath Express",
        "train_number": "12909",
        "source": "Mumbai Bandra",
        "destination": "Ahmedabad",
        "departure_time": "21:50",
        "arrival_time": "05:15",
        "duration": "7h 25m",
        "platform": 2,
        "train_type": "Garib Rath",
        "seat_availability": "Available",
        "stops": [
            {"station_name": "Mumbai Bandra", "arrival": None, "departure": "21:50", "halt_time": None, "stop_order": 1},
            {"station_name": "Borivali", "arrival": "22:18", "departure": "22:20", "halt_time": "2 min", "stop_order": 2},
            {"station_name": "Vapi", "arrival": "00:15", "departure": "00:17", "halt_time": "2 min", "stop_order": 3},
            {"station_name": "Surat", "arrival": "01:30", "departure": "01:35", "halt_time": "5 min", "stop_order": 4},
            {"station_name": "Vadodara Jn", "arrival": "03:00", "departure": "03:05", "halt_time": "5 min", "stop_order": 5},
            {"station_name": "Ahmedabad Jn", "arrival": "05:15", "departure": None, "halt_time": None, "stop_order": 6},
        ]
    },
    {
        "train_name": "Vande Bharat Express",
        "train_number": "22436",
        "source": "New Delhi",
        "destination": "Varanasi",
        "departure_time": "06:00",
        "arrival_time": "14:00",
        "duration": "8h 00m",
        "platform": 1,
        "train_type": "Vande Bharat",
        "seat_availability": "Available",
        "stops": [
            {"station_name": "New Delhi", "arrival": None, "departure": "06:00", "halt_time": None, "stop_order": 1},
            {"station_name": "Kanpur Central", "arrival": "10:00", "departure": "10:02", "halt_time": "2 min", "stop_order": 2},
            {"station_name": "Prayagraj Jn", "arrival": "11:45", "departure": "11:47", "halt_time": "2 min", "stop_order": 3},
            {"station_name": "Varanasi Jn", "arrival": "14:00", "departure": None, "halt_time": None, "stop_order": 4},
        ]
    },
    {
        "train_name": "Tamil Nadu Express",
        "train_number": "12621",
        "source": "New Delhi",
        "destination": "Chennai Central",
        "departure_time": "22:30",
        "arrival_time": "07:10",
        "duration": "32h 40m",
        "platform": 7,
        "train_type": "Superfast",
        "seat_availability": "Waitlist",
        "stops": [
            {"station_name": "New Delhi", "arrival": None, "departure": "22:30", "halt_time": None, "stop_order": 1},
            {"station_name": "Agra Cantt", "arrival": "01:05", "departure": "01:10", "halt_time": "5 min", "stop_order": 2},
            {"station_name": "Jhansi Jn", "arrival": "04:05", "departure": "04:15", "halt_time": "10 min", "stop_order": 3},
            {"station_name": "Bhopal Jn", "arrival": "08:30", "departure": "08:45", "halt_time": "15 min", "stop_order": 4},
            {"station_name": "Nagpur Jn", "arrival": "14:15", "departure": "14:30", "halt_time": "15 min", "stop_order": 5},
            {"station_name": "Balharshah", "arrival": "17:00", "departure": "17:10", "halt_time": "10 min", "stop_order": 6},
            {"station_name": "Vijayawada Jn", "arrival": "00:40", "departure": "00:55", "halt_time": "15 min", "stop_order": 7},
            {"station_name": "Chennai Central", "arrival": "07:10", "departure": None, "halt_time": None, "stop_order": 8},
        ]
    },
    {
        "train_name": "Karnataka Express",
        "train_number": "12627",
        "source": "New Delhi",
        "destination": "Bangalore",
        "departure_time": "21:20",
        "arrival_time": "06:40",
        "duration": "33h 20m",
        "platform": 4,
        "train_type": "Superfast",
        "seat_availability": "Available",
        "stops": [
            {"station_name": "New Delhi", "arrival": None, "departure": "21:20", "halt_time": None, "stop_order": 1},
            {"station_name": "Agra Cantt", "arrival": "00:06", "departure": "00:11", "halt_time": "5 min", "stop_order": 2},
            {"station_name": "Jhansi Jn", "arrival": "03:10", "departure": "03:20", "halt_time": "10 min", "stop_order": 3},
            {"station_name": "Bhopal Jn", "arrival": "07:20", "departure": "07:35", "halt_time": "15 min", "stop_order": 4},
            {"station_name": "Kacheguda", "arrival": "19:45", "departure": "20:00", "halt_time": "15 min", "stop_order": 5},
            {"station_name": "Guntakal Jn", "arrival": "00:20", "departure": "00:30", "halt_time": "10 min", "stop_order": 6},
            {"station_name": "Bangalore City", "arrival": "06:40", "departure": None, "halt_time": None, "stop_order": 7},
        ]
    },
    {
        "train_name": "Mumbai Rajdhani",
        "train_number": "12951",
        "source": "Mumbai Central",
        "destination": "New Delhi",
        "departure_time": "16:35",
        "arrival_time": "08:35",
        "duration": "16h 00m",
        "platform": 2,
        "train_type": "Rajdhani",
        "seat_availability": "Available",
        "stops": [
            {"station_name": "Mumbai Central", "arrival": None, "departure": "16:35", "halt_time": None, "stop_order": 1},
            {"station_name": "Borivali", "arrival": "17:01", "departure": "17:03", "halt_time": "2 min", "stop_order": 2},
            {"station_name": "Surat", "arrival": "20:08", "departure": "20:10", "halt_time": "2 min", "stop_order": 3},
            {"station_name": "Vadodara Jn", "arrival": "21:35", "departure": "21:40", "halt_time": "5 min", "stop_order": 4},
            {"station_name": "Ratlam Jn", "arrival": "00:50", "departure": "00:55", "halt_time": "5 min", "stop_order": 5},
            {"station_name": "Kota Jn", "arrival": "03:55", "departure": "04:00", "halt_time": "5 min", "stop_order": 6},
            {"station_name": "New Delhi", "arrival": "08:35", "departure": None, "halt_time": None, "stop_order": 7},
        ]
    },
    {
        "train_name": "Deccan Queen",
        "train_number": "12124",
        "source": "Mumbai CST",
        "destination": "Pune Jn",
        "departure_time": "17:10",
        "arrival_time": "20:25",
        "duration": "3h 15m",
        "platform": 6,
        "train_type": "Superfast",
        "seat_availability": "Available",
        "stops": [
            {"station_name": "Mumbai CST", "arrival": None, "departure": "17:10", "halt_time": None, "stop_order": 1},
            {"station_name": "Dadar", "arrival": "17:23", "departure": "17:25", "halt_time": "2 min", "stop_order": 2},
            {"station_name": "Thane", "arrival": "17:45", "departure": "17:47", "halt_time": "2 min", "stop_order": 3},
            {"station_name": "Kalyan Jn", "arrival": "18:08", "departure": "18:10", "halt_time": "2 min", "stop_order": 4},
            {"station_name": "Lonavala", "arrival": "19:10", "departure": "19:12", "halt_time": "2 min", "stop_order": 5},
            {"station_name": "Shivajinagar", "arrival": "20:10", "departure": "20:12", "halt_time": "2 min", "stop_order": 6},
            {"station_name": "Pune Jn", "arrival": "20:25", "departure": None, "halt_time": None, "stop_order": 7},
        ]
    },
    {
        "train_name": "Howrah Mail",
        "train_number": "12809",
        "source": "Mumbai CST",
        "destination": "Howrah",
        "departure_time": "21:00",
        "arrival_time": "03:40",
        "duration": "30h 40m",
        "platform": 8,
        "train_type": "Mail/Express",
        "seat_availability": "RAC",
        "stops": [
            {"station_name": "Mumbai CST", "arrival": None, "departure": "21:00", "halt_time": None, "stop_order": 1},
            {"station_name": "Kalyan Jn", "arrival": "21:55", "departure": "22:00", "halt_time": "5 min", "stop_order": 2},
            {"station_name": "Nasik Road", "arrival": "00:20", "departure": "00:25", "halt_time": "5 min", "stop_order": 3},
            {"station_name": "Bhusawal Jn", "arrival": "03:05", "departure": "03:15", "halt_time": "10 min", "stop_order": 4},
            {"station_name": "Nagpur Jn", "arrival": "09:15", "departure": "09:30", "halt_time": "15 min", "stop_order": 5},
            {"station_name": "Raipur Jn", "arrival": "14:20", "departure": "14:30", "halt_time": "10 min", "stop_order": 6},
            {"station_name": "Bilaspur Jn", "arrival": "16:45", "departure": "16:55", "halt_time": "10 min", "stop_order": 7},
            {"station_name": "Tatanagar Jn", "arrival": "23:40", "departure": "23:50", "halt_time": "10 min", "stop_order": 8},
            {"station_name": "Kharagpur Jn", "arrival": "01:45", "departure": "01:47", "halt_time": "2 min", "stop_order": 9},
            {"station_name": "Howrah Jn", "arrival": "03:40", "departure": None, "halt_time": None, "stop_order": 10},
        ]
    },
]


def seed():
    """Drop existing Journey Planner data and re-seed."""
    from models.train import Train, Stop  # noqa: F811
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        # Clear existing data
        session.query(Stop).delete()
        session.query(Train).delete()
        session.commit()
        print("Cleared existing journey planner data.")

        for train_data in TRAINS_DATA:
            stops_data = train_data.pop('stops')
            train = Train(**train_data)
            session.add(train)
            session.flush()  # get train.id

            for stop_data in stops_data:
                stop = Stop(train_id=train.id, **stop_data)
                session.add(stop)

        session.commit()
        print(f"Successfully seeded {len(TRAINS_DATA)} trains with stops.")
    except Exception as e:
        session.rollback()
        print(f"Seeding failed: {e}")
        raise
    finally:
        session.close()


if __name__ == '__main__':
    seed()
