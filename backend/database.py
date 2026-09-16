import os
from contextlib import contextmanager
from typing import Generator
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

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
