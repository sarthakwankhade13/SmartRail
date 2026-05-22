from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '3306')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'railway_ml')

MYSQL_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
SQLITE_PATH = os.path.join(os.path.dirname(__file__), '..', 'ml_engine.db')
SQLITE_URL = f"sqlite:///{SQLITE_PATH}"

Base = declarative_base()

try:
    engine = create_engine(MYSQL_URL, pool_pre_ping=True, connect_args={'connect_timeout': 3})
    # Test connection
    with engine.connect() as conn:
        pass
    logger.info("[ML-Engine] Connected to MySQL successfully.")
except Exception as e:
    logger.warning(f"[ML-Engine] MySQL unavailable ({e}), falling back to SQLite.")
    engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    logger.info("[ML-Engine] Database tables created/verified.")
