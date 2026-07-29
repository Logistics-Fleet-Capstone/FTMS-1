from unittest.mock import patch

from django.db import DatabaseError
from django.test import SimpleTestCase
from rest_framework.test import APIClient


class HealthViewTests(SimpleTestCase):
    databases = {"default"}

    def setUp(self):
        self.client = APIClient()

    def test_health_reports_database_connection(self):
        with patch("health.views.connection.cursor") as cursor:
            response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "ok", "service": "ftms-backend", "database": "ok"},
        )
        cursor.return_value.__enter__.return_value.execute.assert_called_once_with("SELECT 1")

    def test_health_returns_503_when_database_is_unavailable(self):
        with patch("health.views.connection.cursor", side_effect=DatabaseError):
            response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json(),
            {
                "status": "error",
                "service": "ftms-backend",
                "database": "unavailable",
            },
        )
