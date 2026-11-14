import os
import sys
import tempfile
from pathlib import Path

# throwaway database + fixed secret, set BEFORE the app is imported
os.environ["DB_FILE"] = str(Path(tempfile.mkdtemp(prefix="ff-")) / "test.db")
os.environ["SECRET"] = "test-secret"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app  # noqa: E402


@pytest.fixture(scope="session")
def make_client():
    clients = []

    def make():
        c = TestClient(app, base_url="http://127.0.0.1")
        clients.append(c)
        return c
    yield make
    for c in clients:
        c.close()
