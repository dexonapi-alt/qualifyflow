from functools import lru_cache
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.config import settings


class Base(DeclarativeBase):
    pass


def engine():
    # Cached separately to keep import side effects free for migrations and tests.
    return _engine(settings().database_url)


@lru_cache
def _engine(url):
    return create_engine(url, pool_pre_ping=True)


def get_db():
    with Session(engine(), expire_on_commit=False) as db:
        with db.begin():
            yield db
