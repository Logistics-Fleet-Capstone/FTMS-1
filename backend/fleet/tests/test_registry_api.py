# ruff: noqa: E501
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import StaffProfile
from fleet.models import Vehicle


class VehicleRegistryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.vehicle = Vehicle.objects.create(
            device_id="LILYGO-001", plate_number="DEMO-001",
            display_name="Sprint 1 Demo Vehicle",
        )

    def user(self, role=None, superuser=False):
        user = get_user_model().objects.create_user(
            username=f"user-{get_user_model().objects.count()}",
            password="A-strong-test-password-42!", is_staff=True,
            is_superuser=superuser,
        )
        if role:
            StaffProfile.objects.create(user=user, role=role)
        return user

    def payload(self):
        return {
            "device_id": "TEST-001", "plate_number": "test-001",
            "display_name": " Test Vehicle ", "vehicle_type": "VAN",
            "manufacturer": " Maker ", "model": " Model ", "model_year": 2026,
            "passenger_capacity": 12,
        }

    def test_anonymous_registry_and_latest_are_401(self):
        self.assertEqual(self.client.get("/api/v1/vehicles/").status_code, 401)
        self.assertEqual(
            self.client.get("/api/v1/vehicles/LILYGO-001/latest-status/").status_code,
            401,
        )

    def test_dispatcher_reads_but_cannot_write(self):
        self.client.force_authenticate(self.user(StaffProfile.Role.DISPATCHER))
        self.assertEqual(self.client.get("/api/v1/vehicles/").status_code, 200)
        self.assertEqual(self.client.post("/api/v1/vehicles/", self.payload(), format="json").status_code, 403)
        self.assertEqual(self.client.patch("/api/v1/vehicles/LILYGO-001/", {"display_name": "No"}, format="json").status_code, 403)

    def test_manager_edits_but_cannot_create_or_change_status(self):
        self.client.force_authenticate(self.user(StaffProfile.Role.FLEET_MANAGER))
        self.assertEqual(self.client.patch("/api/v1/vehicles/LILYGO-001/", {"display_name": " Updated "}, format="json").status_code, 200)
        self.assertEqual(Vehicle.objects.get().display_name, "Updated")
        self.assertEqual(self.client.post("/api/v1/vehicles/", self.payload(), format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/v1/vehicles/LILYGO-001/deactivate/", {}, format="json").status_code, 403)

    def test_superadmin_create_normalization_immutability_and_status(self):
        self.client.force_authenticate(self.user(superuser=True))
        response = self.client.post("/api/v1/vehicles/", self.payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["plate_number"], "TEST-001")
        self.assertEqual(response.json()["display_name"], "Test Vehicle")
        self.assertEqual(self.client.patch("/api/v1/vehicles/TEST-001/", {"device_id": "OTHER"}, format="json").status_code, 400)
        self.assertFalse(self.client.post("/api/v1/vehicles/TEST-001/deactivate/", {}, format="json").json()["is_active"])
        self.assertTrue(self.client.post("/api/v1/vehicles/TEST-001/reactivate/", {}, format="json").json()["is_active"])

    def test_unknown_readonly_fields_methods_and_case_insensitive_plate(self):
        self.client.force_authenticate(self.user(superuser=True))
        for payload in (
            {**self.payload(), "unknown": True},
            {**self.payload(), "is_active": False},
        ):
            self.assertEqual(self.client.post("/api/v1/vehicles/", payload, format="json").status_code, 400)
        duplicate = {**self.payload(), "device_id": "TEST-002", "plate_number": "demo-001"}
        self.assertEqual(self.client.post("/api/v1/vehicles/", duplicate, format="json").status_code, 400)
        self.assertEqual(self.client.put("/api/v1/vehicles/LILYGO-001/", {}, format="json").status_code, 405)
        self.assertEqual(self.client.delete("/api/v1/vehicles/LILYGO-001/").status_code, 405)

    def test_filters_search_pagination_and_invalid_values(self):
        self.client.force_authenticate(self.user(StaffProfile.Role.DISPATCHER))
        response = self.client.get("/api/v1/vehicles/?search=demo&is_active=true&vehicle_type=OTHER&page_size=100")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"][0]["device_id"], "LILYGO-001")
        for query in ("is_active=yes", "vehicle_type=BOAT", "unknown=x", "page_size=101"):
            self.assertEqual(self.client.get(f"/api/v1/vehicles/?{query}").status_code, 400)
