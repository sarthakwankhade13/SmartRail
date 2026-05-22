"""
Database initializer — creates ALL tables in railai.db (SQLite) or MySQL.

Run once:
    python -m scripts.init_database
"""
import os
import sys
import sqlite3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config.database import SQLITE_PATH

# ── Core tables (raw SQLite) ───────────────────────────────────────────────────
CORE_SCHEMA = """
CREATE TABLE IF NOT EXISTS Users (
    user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    phone         TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Bookings (
    booking_id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                INTEGER NOT NULL,
    train_id               TEXT NOT NULL,
    pnr_number             TEXT UNIQUE NOT NULL,
    source_station_id      TEXT NOT NULL,
    destination_station_id TEXT NOT NULL,
    travel_date            TEXT NOT NULL,
    class_type             TEXT NOT NULL,
    total_fare             REAL NOT NULL,
    booking_status         TEXT DEFAULT 'CONFIRMED',
    booking_date           TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE IF NOT EXISTS Passengers (
    passenger_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id       INTEGER NOT NULL,
    name             TEXT NOT NULL,
    age              INTEGER NOT NULL,
    gender           TEXT NOT NULL,
    seat_number      TEXT,
    berth_preference TEXT,
    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PnrLookups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pnr_number  TEXT NOT NULL,
    source      TEXT NOT NULL,
    result_json TEXT,
    looked_up_at TEXT DEFAULT (datetime('now'))
);
"""


def init_core():
    """Create core tables via raw SQLite."""
    conn = sqlite3.connect(SQLITE_PATH)
    conn.executescript(CORE_SCHEMA)
    conn.commit()
    conn.close()
    print(f"[SmartRail] Core tables ready — {SQLITE_PATH}")


def init_orm():
    """Create ORM-managed tables (Journey, Exchange, Seats)."""
    from config.db import init_db
    init_db()


def init():
    init_core()
    init_orm()
    print("[SmartRail] [OK] All database tables initialized.")


if __name__ == '__main__':
    init()
