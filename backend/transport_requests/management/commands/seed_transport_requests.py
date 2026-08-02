from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from transport_requests.models import TransportRequest
from transport_requests.services import create_request, transition_request


class Command(BaseCommand):
    help = "Seed idempotent simulated-pilot Transport Requests for local development."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin")

    def handle(self, *args, **options):
        try:
            user = get_user_model().objects.get(username=options["username"])
        except get_user_model().DoesNotExist as exc:
            raise CommandError("Create the requested staff user first.") from exc
        examples = [
            (
                "PILOT-OXFORD-NAIA",
                "AIRPORT_PICKUP",
                "Oxford Suites Makati",
                "NAIA Terminal 3",
                "APPROVED",
            ),
            (
                "PILOT-OXFORD-BGC",
                "GUEST_TRANSFER",
                "Oxford Suites Makati",
                "BGC High Street",
                "PENDING_APPROVAL",
            ),
            (
                "PILOT-OXFORD-ROCKWELL",
                "BANQUET_LOGISTICS",
                "Oxford Suites Makati",
                "Rockwell Event Hall",
                "SUBMITTED",
            ),
        ]
        created = 0
        for reference, kind, pickup, destination, target in examples:
            if TransportRequest.objects.filter(external_reference=reference).exists():
                continue
            item = create_request(
                user=user,
                validated_data={
                    "request_type": kind,
                    "requester_name": "Simulated Pilot Data",
                    "source_system": "FTMS",
                    "external_reference": reference,
                    "pickup_address": pickup,
                    "destination_address": destination,
                    "scheduled_at": timezone.now() + timedelta(days=1),
                    "priority": "NORMAL",
                    "special_instructions": "SIMULATED PILOT DATA — not a live trip.",
                },
            )
            if target in {"PENDING_APPROVAL", "APPROVED"}:
                transition_request(request_number=item.request_number, action="submit", user=user)
            if target == "APPROVED":
                transition_request(request_number=item.request_number, action="approve", user=user)
            created += 1
        self.stdout.write(self.style.SUCCESS(f"Created {created} simulated pilot requests."))
