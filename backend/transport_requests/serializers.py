from django.contrib.gis.geos import Point
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from fleet.serializers import StrictFieldsMixin

from .models import TransportRequest, TransportRequestStatusHistory
from .services import create_request


class PointSerializer(serializers.Serializer):
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    latitude = serializers.FloatField(min_value=-90, max_value=90)

    def to_representation(self, value):
        if value is None:
            return None
        return {"longitude": value.x, "latitude": value.y}

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        return Point(values["longitude"], values["latitude"], srid=4326)


class TransportRequestSerializer(StrictFieldsMixin, serializers.ModelSerializer):
    pickup_location = PointSerializer(required=False, allow_null=True)
    destination_location = PointSerializer(required=False, allow_null=True)
    created_by = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = TransportRequest
        fields = [
            "request_number",
            "request_type",
            "requester_name",
            "requester_contact",
            "source_system",
            "external_reference",
            "pickup_address",
            "pickup_location",
            "destination_address",
            "destination_location",
            "scheduled_at",
            "priority",
            "passenger_count",
            "load_description",
            "required_vehicle_type",
            "special_instructions",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["request_number", "status", "created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        forbidden = {"request_number", "status", "created_by", "created_at", "updated_at"}
        errors = {
            key: "This field is not accepted." for key in forbidden if key in self.initial_data
        }
        for field in ("requester_name", "pickup_address", "destination_address"):
            if field in attrs:
                attrs[field] = attrs[field].strip()
                if not attrs[field]:
                    errors[field] = "Must not be empty."
        scheduled = attrs.get("scheduled_at")
        raw_scheduled = self.initial_data.get("scheduled_at")
        parsed_raw = parse_datetime(raw_scheduled) if isinstance(raw_scheduled, str) else None
        if scheduled is not None and (
            timezone.is_naive(scheduled)
            or parsed_raw is None
            or parsed_raw.utcoffset() is None
        ):
            errors["scheduled_at"] = "Must include a timezone offset."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        return create_request(user=self.context["request"].user, validated_data=validated_data)


class HistorySerializer(serializers.ModelSerializer):
    performed_by = serializers.CharField(source="performed_by.username")

    class Meta:
        model = TransportRequestStatusHistory
        fields = ["from_status", "to_status", "action", "remarks", "performed_by", "performed_at"]


class RemarksSerializer(StrictFieldsMixin, serializers.Serializer):
    remarks = serializers.CharField(trim_whitespace=True, allow_blank=False)
