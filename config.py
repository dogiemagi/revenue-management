import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'revtrack-fin-super-secret-key-2026')
    
    # Support both PostgreSQL on Render/Neon/Supabase and local SQLite
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        # Normalise legacy postgres:// prefix
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        # Force psycopg2 driver — avoids "No module named 'psycopg'" on Python 3.14
        if database_url.startswith("postgresql://") and "+" not in database_url.split("://")[0]:
            database_url = database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        SQLALCHEMY_DATABASE_URI = database_url
    else:
        # Default to local SQLite database in the app directory
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'revenue.db')}"
        
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max
