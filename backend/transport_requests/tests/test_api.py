from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import StaffProfile
from transport_requests.models import TransportRequest, TransportRequestStatusHistory


class TransportRequestApiTests(TestCase):
    password = "A-strong-test-password-42!"

    def user(self, role=None, *, staff=True, superuser=False):
        user = get_user_model().objects.create_user(
            username=f"user-{get_user_model().objects.count()}",
            password=self.password,
            is_staff=staff,
            is_superuser=superuser,
        )
        if role:
            StaffProfile.objects.create(user=user, role=role)
        return user

    def client_for(self, user, csrf=False):
        client = APIClient(enforce_csrf_checks=csrf)
        self.assertTrue(client.login(username=user.username, password=self.password))
        return client

    def payload(self, **changes):
        payload = {
            "request_type": "AIRPORT_PICKUP",
            "requester_name": " Maria Santos ",
            "source_system": "MANUAL",
            "external_reference": "PILOT-1",
            "pickup_address": " NAIA Terminal 3 ",
            "pickup_location": {"longitude": 121.0138, "latitude": 14.5196},
            "destination_address": " Oxford Suites Makati ",
            "destination_location": {"longitude": 121.0286, "latitude": 14.5631},
            "scheduled_at": (timezone.now() + timedelta(days=1)).isoformat(),
            "priority": "HIGH",
            "passenger_count": 2,
            "required_vehicle_type": "SEDAN",
            "special_instructions": "Lobby pickup",
        }
        payload.update(changes)
        return payload

    def create(self, client, **changes):
        return client.post("/api/v1/transport-requests/", self.payload(**changes), format="json")

    def test_authentication_and_permission_matrix(self):
        self.assertEqual(APIClient().get("/api/v1/transport-requests/").status_code, 401)
        for user in (self.user(staff=False), self.user()):
            client = self.client_for(user)
            self.assertEqual(client.get("/api/v1/transport-requests/").status_code, 403)
        dispatcher = self.client_for(self.user(StaffProfile.Role.DISPATCHER))
        self.assertEqual(dispatcher.get("/api/v1/transport-requests/").status_code, 200)
        self.assertEqual(self.create(dispatcher).status_code, 403)
        for user in (self.user(StaffProfile.Role.FLEET_MANAGER), self.user(superuser=True)):
            self.assertEqual(self.create(self.client_for(user)).status_code, 201)

    def test_create_normalizes_fields_points_number_and_creation_history(self):
        response = self.create(self.client_for(self.user(superuser=True)))
        self.assertEqual(response.status_code, 201)
        item = TransportRequest.objects.get()
        self.assertRegex(item.request_number, r"^TR-\d{6}-0001$")
        self.assertEqual(item.requester_name, "Maria Santos")
        self.assertEqual(item.pickup_location, Point(121.0138, 14.5196, srid=4326))
        self.assertEqual(item.pickup_location.srid, 4326)
        self.assertEqual(item.status_history.get().action, "create")

    def test_numbers_are_unique_and_immutable(self):
        client = self.client_for(self.user(superuser=True))
        first = self.create(client).json()["request_number"]
        second = self.create(client, external_reference="PILOT-2").json()["request_number"]
        self.assertNotEqual(first, second)
        item = TransportRequest.objects.get(request_number=first)
        item.request_number = "TR-000000-9999"
        with self.assertRaises(ValueError):
            item.save()

    def test_strict_validation_and_immutable_api_fields(self):
        client = self.client_for(self.user(superuser=True))
        for changes in (
            {"unknown": True},
            {"passenger_count": 0},
            {"pickup_location": {"longitude": 181, "latitude": 0}},
            {"scheduled_at": "2026-08-03T10:00:00"},
            {"requester_name": " "},
        ):
            self.assertEqual(self.create(client, **changes).status_code, 400)
        number = self.create(client, external_reference="valid").json()["request_number"]
        for field in ("status", "request_number", "created_by"):
            self.assertEqual(
                client.patch(
                    f"/api/v1/transport-requests/{number}/", {field: "x"}, format="json"
                ).status_code,
                400,
            )

    def test_submit_approve_and_exact_history(self):
        client = self.client_for(self.user(StaffProfile.Role.FLEET_MANAGER))
        number = self.create(client).json()["request_number"]
        self.assertEqual(
            client.post(
                f"/api/v1/transport-requests/{number}/submit/", {}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(
            client.post(
                f"/api/v1/transport-requests/{number}/approve/", {}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(
            TransportRequestStatusHistory.objects.filter(
                transport_request__request_number=number
            ).count(),
            3,
        )
        self.assertEqual(
            client.post(
                f"/api/v1/transport-requests/{number}/approve/", {}, format="json"
            ).status_code,
            409,
        )
        self.assertEqual(
            TransportRequestStatusHistory.objects.filter(
                transport_request__request_number=number
            ).count(),
            3,
        )

    def test_reject_and_request_details_require_remarks(self):
        client = self.client_for(self.user(superuser=True))
        for action in ("reject", "request-details"):
            number = self.create(client, external_reference=action).json()["request_number"]
            client.post(f"/api/v1/transport-requests/{number}/submit/", {}, format="json")
            self.assertEqual(
                client.post(
                    f"/api/v1/transport-requests/{number}/{action}/", {}, format="json"
                ).status_code,
                400,
            )
            self.assertEqual(
                client.post(
                    f"/api/v1/transport-requests/{number}/{action}/",
                    {"remarks": "Need information"},
                    format="json",
                ).status_code,
                200,
            )

    def test_request_details_resubmit_and_cancel_transitions(self):
        client = self.client_for(self.user(superuser=True))
        number = self.create(client).json()["request_number"]
        client.post(f"/api/v1/transport-requests/{number}/submit/", {}, format="json")
        client.post(
            f"/api/v1/transport-requests/{number}/request-details/",
            {"remarks": "Add load"},
            format="json",
        )
        self.assertEqual(
            client.post(
                f"/api/v1/transport-requests/{number}/resubmit/", {}, format="json"
            ).status_code,
            200,
        )
        other = self.create(client, external_reference="cancel").json()["request_number"]
        self.assertEqual(
            client.post(f"/api/v1/transport-requests/{other}/cancel/", {}, format="json").json()[
                "status"
            ],
            "CANCELLED",
        )

    def test_dispatcher_reads_history_but_cannot_transition(self):
        manager = self.client_for(self.user(StaffProfile.Role.FLEET_MANAGER))
        number = self.create(manager).json()["request_number"]
        dispatcher = self.client_for(self.user(StaffProfile.Role.DISPATCHER))
        self.assertEqual(
            dispatcher.get(f"/api/v1/transport-requests/{number}/history/").status_code, 200
        )
        self.assertEqual(
            dispatcher.post(
                f"/api/v1/transport-requests/{number}/submit/", {}, format="json"
            ).status_code,
            403,
        )

    def test_search_filters_ordering_and_page_limit(self):
        client = self.client_for(self.user(superuser=True))
        self.create(client)
        url = (
            "/api/v1/transport-requests/?search=Maria&status=SUBMITTED"
            "&priority=HIGH&request_type=AIRPORT_PICKUP&ordering=scheduled_at"
        )
        self.assertEqual(client.get(url).json()["count"], 1)
        for query in ("page_size=101", "status=ACTIVE", "ordering=id", "unknown=x"):
            self.assertEqual(client.get(f"/api/v1/transport-requests/?{query}").status_code, 400)

    def test_session_mutation_enforces_csrf(self):
        client = self.client_for(self.user(superuser=True), csrf=True)
        self.assertEqual(self.create(client).status_code, 403)
