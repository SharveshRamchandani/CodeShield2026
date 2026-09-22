from database import get_db
import json

def migrate():
    gen = get_db()
    db = next(gen)
    try:
        with db.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS system_settings (
                    key VARCHAR(64) PRIMARY KEY,
                    value JSONB NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)
            cur.execute("""
                INSERT INTO system_settings (key, value)
                VALUES ('submission_window', '{"opens_at": null, "closes_at": null}'::jsonb)
                ON CONFLICT (key) DO NOTHING;
            """)
            db.commit()
            print("system_settings migration completed successfully.")
    finally:
        try:
            next(gen)
        except StopIteration:
            pass

if __name__ == "__main__":
    migrate()
