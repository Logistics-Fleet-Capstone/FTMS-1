import uuid

import django.contrib.gis.db.models.fields
import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="TransportRequestNumberSequence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(unique=True)),
                ("value", models.PositiveIntegerField(default=0)),
            ],
        ),
        migrations.CreateModel(
            name="TransportRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("request_number", models.CharField(editable=False, max_length=18, unique=True)),
                ("request_type", models.CharField(choices=[("AIRPORT_PICKUP", "Airport pickup"), ("AIRPORT_DROPOFF", "Airport drop-off"), ("GUEST_TRANSFER", "Guest transfer"), ("STAFF_SHUTTLE", "Staff shuttle"), ("FOOD_DELIVERY", "Food delivery"), ("SUPPLIER_PICKUP", "Supplier pickup"), ("VIP_TRANSPORT", "VIP transport"), ("BANQUET_LOGISTICS", "Banquet logistics"), ("OTHER", "Other")], max_length=32)),
                ("requester_name", models.CharField(max_length=160)),
                ("requester_contact", models.CharField(blank=True, default="", max_length=160)),
                ("source_system", models.CharField(choices=[("FTMS", "FTMS"), ("HRMS", "HRMS"), ("HOTEL_OPERATIONS", "Hotel operations"), ("RESTAURANT_OPERATIONS", "Restaurant operations"), ("MANUAL", "Manual")], default="MANUAL", max_length=32)),
                ("external_reference", models.CharField(blank=True, default="", max_length=120)),
                ("pickup_address", models.CharField(max_length=500)),
                ("pickup_location", django.contrib.gis.db.models.fields.PointField(blank=True, null=True, srid=4326)),
                ("destination_address", models.CharField(max_length=500)),
                ("destination_location", django.contrib.gis.db.models.fields.PointField(blank=True, null=True, srid=4326)),
                ("scheduled_at", models.DateTimeField()),
                ("priority", models.CharField(choices=[("NORMAL", "Normal"), ("HIGH", "High")], default="NORMAL", max_length=10)),
                ("passenger_count", models.PositiveIntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1)])),
                ("load_description", models.CharField(blank=True, default="", max_length=500)),
                ("required_vehicle_type", models.CharField(blank=True, default="", max_length=80)),
                ("special_instructions", models.TextField(blank=True, default="")),
                ("status", models.CharField(choices=[("SUBMITTED", "Submitted"), ("PENDING_APPROVAL", "Pending approval"), ("MORE_DETAILS_REQUIRED", "More details required"), ("APPROVED", "Approved"), ("REJECTED", "Rejected"), ("CANCELLED", "Cancelled")], default="SUBMITTED", max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="transport_requests_created", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.CreateModel(
            name="TransportRequestStatusHistory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("from_status", models.CharField(blank=True, default="", max_length=32)),
                ("to_status", models.CharField(choices=[("SUBMITTED", "Submitted"), ("PENDING_APPROVAL", "Pending approval"), ("MORE_DETAILS_REQUIRED", "More details required"), ("APPROVED", "Approved"), ("REJECTED", "Rejected"), ("CANCELLED", "Cancelled")], max_length=32)),
                ("action", models.CharField(max_length=32)),
                ("remarks", models.TextField(blank=True, default="")),
                ("performed_at", models.DateTimeField(auto_now_add=True)),
                ("performed_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="transport_request_actions", to=settings.AUTH_USER_MODEL)),
                ("transport_request", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="status_history", to="transport_requests.transportrequest")),
            ],
            options={"ordering": ("performed_at", "id")},
        ),
        migrations.AddIndex(model_name="transportrequest", index=models.Index(fields=["status", "scheduled_at"], name="tr_status_schedule_idx")),
        migrations.AddIndex(model_name="transportrequest", index=models.Index(fields=["priority"], name="tr_priority_idx")),
        migrations.AddIndex(model_name="transportrequest", index=models.Index(fields=["request_type"], name="tr_type_idx")),
        migrations.AddIndex(model_name="transportrequest", index=models.Index(fields=["created_at"], name="tr_created_idx")),
        migrations.AddIndex(model_name="transportrequeststatushistory", index=models.Index(fields=["transport_request", "performed_at"], name="tr_history_time_idx")),
        migrations.AddConstraint(model_name="transportrequest", constraint=models.CheckConstraint(condition=models.Q(("passenger_count__isnull", True), ("passenger_count__gte", 1), _connector="OR"), name="tr_passenger_count_positive")),
    ]

