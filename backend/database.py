import os
import logging
from contextlib import contextmanager
from typing import Generator
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Ensure .env is loaded from the backend directory regardless of cwd
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    """
    Creates and returns a raw psycopg2 database connection.
    Caller is responsible for closing the connection.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set in .env")
    return psycopg2.connect(DATABASE_URL)


def init_db_migrations():
    """
    Runs idempotent database migrations on startup.
    Ensures email_sent column exists on teams table and is_locked on submissions table.
    """
    if not DATABASE_URL:
        return
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("ALTER TABLE teams ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;")
            cur.execute("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;")
            conn.commit()
        conn.close()
        logger.info("Database schema migration verified successfully (email_sent & is_locked columns).")
    except Exception as err:
        logger.warning(f"Database schema migration check skipped or failed: {err}")


@contextmanager
def get_db_context() -> Generator:
    """
    Context manager for database connections with auto-rollback on exception
    and safe closing upon exit.
    """
    conn = get_connection()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_db():
    """
    FastAPI dependency that provides a database connection and ensures
    it is cleanly closed after the request lifecycle.
    """
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
