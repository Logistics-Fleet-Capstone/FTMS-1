import uuid

from django.conf import settings
from django.contrib.gis.db import models
from django.core.validators import MinValueValidator


class TransportRequestNumberSequence(models.Model):
    date = models.DateField(unique=True)
    value = models.PositiveIntegerField(default=0)


class TransportRequest(models.Model):
    class RequestType(models.TextChoices):
        AIRPORT_PICKUP = "AIRPORT_PICKUP", "Airport pickup"
        AIRPORT_DROPOFF = "AIRPORT_DROPOFF", "Airport drop-off"
        GUEST_TRANSFER = "GUEST_TRANSFER", "Guest transfer"
        STAFF_SHUTTLE = "STAFF_SHUTTLE", "Staff shuttle"
        FOOD_DELIVERY = "FOOD_DELIVERY", "Food delivery"
        SUPPLIER_PICKUP = "SUPPLIER_PICKUP", "Supplier pickup"
        VIP_TRANSPORT = "VIP_TRANSPORT", "VIP transport"
        BANQUET_LOGISTICS = "BANQUET_LOGISTICS", "Banquet logistics"
        OTHER = "OTHER", "Other"

    class SourceSystem(models.TextChoices):
        FTMS = "FTMS", "FTMS"
        HRMS = "HRMS", "HRMS"
        HOTEL_OPERATIONS = "HOTEL_OPERATIONS", "Hotel operations"
        RESTAURANT_OPERATIONS = "RESTAURANT_OPERATIONS", "Restaurant operations"
        MANUAL = "MANUAL", "Manual"

    class Priority(models.TextChoices):
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"

    class Status(models.TextChoices):
        SUBMITTED = "SUBMITTED", "Submitted"
        PENDING_APPROVAL = "PENDING_APPROVAL", "Pending approval"
        MORE_DETAILS_REQUIRED = "MORE_DETAILS_REQUIRED", "More details required"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_number = models.CharField(max_length=18, unique=True, editable=False)
    request_type = models.CharField(max_length=32, choices=RequestType.choices)
    requester_name = models.CharField(max_length=160)
    requester_contact = models.CharField(max_length=160, blank=True, default="")
    source_system = models.CharField(
        max_length=32, choices=SourceSystem.choices, default=SourceSystem.MANUAL
    )
    external_reference = models.CharField(max_length=120, blank=True, default="")
    pickup_address = models.CharField(max_length=500)
    pickup_location = models.PointField(srid=4326, null=True, blank=True)
    destination_address = models.CharField(max_length=500)
    destination_location = models.PointField(srid=4326, null=True, blank=True)
    scheduled_at = models.DateTimeField()
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    passenger_count = models.PositiveIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1)]
    )
    load_description = models.CharField(max_length=500, blank=True, default="")
    required_vehicle_type = models.CharField(max_length=80, blank=True, default="")
    special_instructions = models.TextField(blank=True, default="")
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.SUBMITTED)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="transport_requests_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["status", "scheduled_at"], name="tr_status_schedule_idx"),
            models.Index(fields=["priority"], name="tr_priority_idx"),
            models.Index(fields=["request_type"], name="tr_type_idx"),
            models.Index(fields=["created_at"], name="tr_created_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(passenger_count__isnull=True) | models.Q(passenger_count__gte=1),
                name="tr_passenger_count_positive",
            )
        ]

    def save(self, *args, **kwargs):
        for field in (
            "requester_name",
            "requester_contact",
            "external_reference",
            "pickup_address",
            "destination_address",
            "load_description",
            "required_vehicle_type",
            "special_instructions",
        ):
            value = getattr(self, field)
            if isinstance(value, str):
                setattr(self, field, value.strip())
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            original = type(self).objects.only("request_number").get(pk=self.pk)
            if original.request_number != self.request_number:
                raise ValueError("request_number is immutable.")
        super().save(*args, **kwargs)


class TransportRequestStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transport_request = models.ForeignKey(
        TransportRequest, on_delete=models.CASCADE, related_name="status_history"
    )
    from_status = models.CharField(max_length=32, blank=True, default="")
    to_status = models.CharField(max_length=32, choices=TransportRequest.Status.choices)
    action = models.CharField(max_length=32)
    remarks = models.TextField(blank=True, default="")
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="transport_request_actions",
    )
    performed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("performed_at", "id")
        indexes = [
            models.Index(fields=["transport_request", "performed_at"], name="tr_history_time_idx")
        ]
