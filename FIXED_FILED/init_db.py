#!/usr/bin/env python3
"""Initialize EchoSphere database — create all tables."""
import asyncio
import sys
import os

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base, async_session_factory
from app.models.user import User
from app.models.organization import Organization, OrgMember
from app.models.panel import Panel, Assessment, OrganizationQuestion
from app.models.session import Session, Batch, BatchSession
from app.models.whiteboard import WhiteboardEvent, WhiteboardState
from app.models.transcript import TranscriptTurn, Report, Roadmap, IntegrityEvent


async def init_database():
    """Create all database tables."""
    print("Creating database tables...")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("All tables created successfully.")
    print()
    print("Tables created:")
    for table_name in sorted(Base.metadata.tables.keys()):
        print(f"  - {table_name}")


async def seed_demo_data():
    """Seed minimal demo data for development."""
    print("\nSeeding demo data (if needed)...")
    
    async with async_session_factory() as session:
        # Check if data already exists
        from sqlalchemy import select, text
        result = await session.execute(select(User).limit(1))
        existing = result.scalar_one_or_none()
        
        if existing:
            print("Database already has data. Skipping seed.")
            return
        
        # Create demo users
        from app.models.user import User, UserRole
        
        student = User(
            id="demo-student-001",
            role=UserRole.STUDENT,
            email="student@example.com",
            name="Demo Student",
            password_hash=None,  # Social login demo
        )
        session.add(student)
        
        hr = User(
            id="demo-hr-001",
            role=UserRole.HR_ADMIN,
            email="hr@example.com",
            name="Demo HR Admin",
            password_hash=None,
        )
        session.add(hr)
        
        org = Organization(
            id="demo-org-001",
            name="Demo University Placement Cell",
            official_email="placement@demo.edu",
            created_by="demo-hr-001",
        )
        session.add(org)
        
        await session.commit()
        print("Demo users created: student@example.com, hr@example.com")


async def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="EchoSphere Database Manager")
    parser.add_argument(
        "command",
        nargs="?",
        default="init",
        choices=["init", "seed", "reset", "status"],
        help="Command to run",
    )
    args = parser.parse_args()
    
    if args.command == "init":
        await init_database()
        await seed_demo_data()
    elif args.command == "seed":
        await seed_demo_data()
    elif args.command == "reset":
        print("WARNING: This will drop all tables. Type 'yes' to confirm: ", end="")
        import shutil
        if input().strip().lower() != "yes":
            print("Aborted.")
            return
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await init_database()
        print("Database reset complete.")
    elif args.command == "status":
        async with async_session_factory() as session:
            from sqlalchemy import text
            result = await session.execute(text("SELECT version();"))
            version = result.scalar()
            print(f"PostgreSQL version: {version}")

        from sqlalchemy import inspect

        def _get_table_names(sync_conn):
            return inspect(sync_conn).get_table_names()

        async with engine.connect() as conn:
            tables = await conn.run_sync(_get_table_names)
        print(f"Tables ({len(tables)}): {', '.join(sorted(tables))}")


if __name__ == "__main__":
    asyncio.run(main())
