import pytest
from rest_framework.test import APIClient

from users.tests.factories import AdminFactory


@pytest.fixture
def auth_client(db):
    client = APIClient()
    client.force_authenticate(user=AdminFactory())
    return client
