"""
Unified database configuration for SmartRail.

Priority:
  1. MySQL (from .env) — used if reachable
  2. Local SQLite (railai.db) — reliable fallback

All parts of the app import from here.
"""
import os
import sqlite3
import logging
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQLITE_PATH = os.path.join(BASE_DIR, 'railai.db')

# ── MySQL credentials from .env ────────────────────────────────────────────────
DB_HOST     = os.getenv('DB_HOST',     'localhost')
DB_PORT     = int(os.getenv('DB_PORT', '3306'))
DB_USER     = os.getenv('DB_USER',     'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME     = os.getenv('DB_NAME',     'railai')

# ── Detect which DB is available ───────────────────────────────────────────────
_using_mysql = False

def _test_mysql() -> bool:
    try:
        import pymysql
        conn = pymysql.connect(
            host=DB_HOST, port=DB_PORT,
            user=DB_USER, password=DB_PASSWORD,
            connect_timeout=4,
        )
        cur = conn.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        conn.select_db(DB_NAME)
        conn.close()
        return True
    except Exception as e:
        log.debug("MySQL unavailable: %s", e)
        return False

_using_mysql = _test_mysql()

if _using_mysql:
    print(f"[SmartRail] [OK] Connected to MySQL - database: {DB_NAME}")
else:
    print(f"[SmartRail] [SQLite] Using local SQLite - {SQLITE_PATH}")

DB_PATH = SQLITE_PATH  # kept for legacy imports


# ── SQLite raw connection (used by auth/bookings routes) ───────────────────────
def get_connection():
    """Raw SQLite connection with row factory."""
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn
