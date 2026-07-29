from getpass import getpass

from django.contrib.auth import get_user_model, password_validation
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import StaffProfile


class Command(BaseCommand):
    help = "Create an active regular staff user with a validated hidden password prompt."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True)
        parser.add_argument("--role", required=True, choices=StaffProfile.Role.values)

    @transaction.atomic
    def handle(self, *args, **options):
        user_model = get_user_model()
        username = options["username"]
        if user_model.objects.filter(username=username).exists():
            raise CommandError("A user with that username already exists.")
        password = getpass("Password: ")
        confirmation = getpass("Password (again): ")
        if password != confirmation:
            raise CommandError("Passwords do not match.")
        candidate = user_model(username=username, is_active=True, is_staff=True)
        try:
            password_validation.validate_password(password, candidate)
        except Exception as exc:
            raise CommandError("Password does not meet security requirements.") from exc
        candidate.set_password(password)
        candidate.save()
        StaffProfile.objects.create(user=candidate, role=options["role"])
        self.stdout.write(self.style.SUCCESS(f"Staff user {username} created."))
