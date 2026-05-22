"""
SQLAlchemy ORM setup — unified for all models.

Uses MySQL if available (from .env), otherwise SQLite (railai.db).
All models (Train, Exchange, Seat, etc.) use this engine.
"""
import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQLITE_PATH = os.path.join(BASE_DIR, 'railai.db')
SQLITE_URL  = f"sqlite:///{SQLITE_PATH}"

DB_HOST     = os.getenv('DB_HOST',     'localhost')
DB_PORT     = os.getenv('DB_PORT',     '3306')
DB_USER     = os.getenv('DB_USER',     'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME     = os.getenv('DB_NAME',     'railai')

MYSQL_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    "?charset=utf8mb4"
)

Base = declarative_base()

# ── Try MySQL, fall back to SQLite ─────────────────────────────────────────────
def _make_engine():
    try:
        eng = create_engine(
            MYSQL_URL,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_timeout=5,
            connect_args={'connect_timeout': 4},
            echo=False,
        )
        with eng.connect() as c:
            c.execute(text("SELECT 1"))
        log.info("[SmartRail-ORM] Connected to MySQL: %s", DB_NAME)
        return eng, True
    except Exception as e:
        log.info("[SmartRail-ORM] MySQL unavailable (%s), using SQLite.", type(e).__name__)
        eng = create_engine(
            SQLITE_URL,
            echo=False,
            connect_args={"check_same_thread": False},
        )
        return eng, False

engine, _mysql_active = _make_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_session():
    return SessionLocal()


def init_db():
    """Create all ORM-managed tables."""
    from models.train    import Train, Stop                          # noqa
    from models.exchange import Passenger, ExchangeRequest, ExchangeMatch  # noqa
    from models.seat     import TrainCoach, Seat                    # noqa
    Base.metadata.create_all(bind=engine)
    db_type = "MySQL" if _mysql_active else "SQLite"
    print(f"[SmartRail] ORM tables ready ({db_type}: {DB_NAME if _mysql_active else SQLITE_PATH})")
