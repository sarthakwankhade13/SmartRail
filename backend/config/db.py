"""
SQLAlchemy database setup for Journey Planner feature.
Tries MySQL first (credentials from .env), falls back to SQLite if unavailable.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '3306')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'railway')

MYSQL_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
SQLITE_PATH = os.path.join(os.path.dirname(__file__), '..', 'journey_planner.db')
SQLITE_URL = f"sqlite:///{SQLITE_PATH}"

Base = declarative_base()

# Try MySQL, fall back to SQLite
try:
    engine = create_engine(MYSQL_URL, pool_pre_ping=True, pool_recycle=3600,
                           echo=False, connect_args={'connect_timeout': 3})
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("[JourneyPlanner] Connected to MySQL.")
except Exception as e:
    print(f"[JourneyPlanner] MySQL unavailable ({e.__class__.__name__}), using SQLite fallback.")
    engine = create_engine(SQLITE_URL, echo=False,
                           connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_session():
    """Get a new database session."""
    return SessionLocal()


def init_db():
    """Create all tables that don't exist yet."""
    from models.train import Train, Stop  # noqa: F401
    Base.metadata.create_all(bind=engine)
    print("[JourneyPlanner] Database tables initialized.")
