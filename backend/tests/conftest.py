"""
pytest 配置文件：
- 使用内存 SQLite 数据库，测试间完全隔离
- 每个测试用例使用独立 DB session，测试后自动清理
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database.models import Base
from backend.database.session import get_db
from backend.main import app


# ── 内存数据库（每次测试重建，不污染真实数据）─────────────────────────────

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="session")
def engine():
    """创建测试数据库引擎（session 级别，整个测试会话共用）"""
    eng = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)


@pytest.fixture(scope="function")
def db_session(engine):
    """每个测试函数使用独立事务，测试后回滚"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient，DB dependency 替换为测试 session"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # 植入预置指标数据
    from backend.seeds.indicators import seed_indicators
    seed_indicators(db_session)

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def seeded_client(client):
    """已包含预置指标的客户端（alias for clarity）"""
    return client
