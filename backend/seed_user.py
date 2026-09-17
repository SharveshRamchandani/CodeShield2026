"""
CodeShield 2026 — User Seed CLI Tool
Securely seeds an Admin or Judge user in the database with bcrypt password hashing.

Usage examples:
    # Interactive prompt:
    python seed_user.py

    # Non-interactive using arguments or env vars:
    python seed_user.py --role admin --email admin@codeshield.org --name "Head Admin" --password "supersecret"
    ADMIN_PASSWORD="supersecret" python seed_user.py --role admin --email admin@codeshield.org --name "Head Admin"
"""

import os
import sys
import getpass
import argparse
import psycopg2
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def main():
    parser = argparse.ArgumentParser(description="Seed Admin or Judge user into CodeShield 2026 database.")
    parser.add_argument("--role", choices=["admin", "judge"], help="User role (admin or judge)")
    parser.add_argument("--email", help="User email address")
    parser.add_argument("--name", help="User full name")
    parser.add_argument("--password", help="User password (optional, will prompt securely if omitted)")

    args = parser.parse_args()

    # Collect role
    role = args.role
    if not role:
        print("\n--- CodeShield 2026 User Setup ---")
        role_input = input("Select role [1] admin, [2] judge (default: admin): ").strip()
        role = "judge" if role_input == "2" else "admin"

    # Collect email
    email = args.email
    if not email:
        email = input(f"Enter {role} email address: ").strip()
    if not email or "@" not in email:
        print("Error: A valid email address is required.", file=sys.stderr)
        sys.exit(1)

    # Collect name
    name = args.name
    if not name:
        default_name = "CodeShield Admin" if role == "admin" else "Panel Judge"
        name_input = input(f"Enter full name (default: {default_name}): ").strip()
        name = name_input if name_input else default_name

    # Collect password
    password = args.password or os.environ.get("ADMIN_PASSWORD" if role == "admin" else "JUDGE_PASSWORD")
    if not password:
        password = getpass.getpass(f"Enter password for {email}: ")
        confirm_password = getpass.getpass("Confirm password: ")
        if password != confirm_password:
            print("Error: Passwords do not match.", file=sys.stderr)
            sys.exit(1)

    if len(password) < 6:
        print("Error: Password must be at least 6 characters long.", file=sys.stderr)
        sys.exit(1)

    # Database connection
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL is not set in environment or .env file.", file=sys.stderr)
        sys.exit(1)

    password_hash = hash_password(password)

    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()

        # Check if user already exists
        cur.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(%s);", (email.lower(),))
        existing = cur.fetchone()

        if existing:
            cur.execute(
                """
                UPDATE users
                SET password_hash = %s, role = %s, name = %s
                WHERE id = %s
                RETURNING id, email, role, name;
                """,
                (password_hash, role, name, existing[0]),
            )
            updated = cur.fetchone()
            conn.commit()
            print(f"\n✓ Successfully updated existing user:")
            print(f"  ID:    {updated[0]}")
            print(f"  Email: {updated[1]}")
            print(f"  Role:  {updated[2]}")
            print(f"  Name:  {updated[3]}")
        else:
            cur.execute(
                """
                INSERT INTO users (email, password_hash, role, name)
                VALUES (%s, %s, %s, %s)
                RETURNING id, email, role, name;
                """,
                (email.lower(), password_hash, role, name),
            )
            created = cur.fetchone()
            conn.commit()
            print(f"\n✓ Successfully created new {role} user:")
            print(f"  ID:    {created[0]}")
            print(f"  Email: {created[1]}")
            print(f"  Role:  {created[2]}")
            print(f"  Name:  {created[3]}")

        cur.close()
        conn.close()
    except psycopg2.Error as db_err:
        print(f"\nDatabase error: {db_err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
