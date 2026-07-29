from datetime import UTC, datetime

from django.db.models.functions import Lower
from rest_framework import serializers

from .models import Vehicle


class StrictFieldsMixin:
    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            unknown = set(data.keys()) - set(self.fields)
            if unknown:
                raise serializers.ValidationError({
                    field: ["Unknown field."] for field in sorted(unknown)
                })
        return super().to_internal_value(data)


class VehicleSerializer(StrictFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = [
            "device_id", "plate_number", "display_name", "vehicle_type",
            "manufacturer", "model", "model_year", "passenger_capacity",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_device_id(self, value):
        if self.instance is not None:
            raise serializers.ValidationError("This field is immutable.")
        return value

    def validate_plate_number(self, value):
        value = value.strip().upper()
        query = Vehicle.objects.annotate(normalized=Lower("plate_number")).filter(
            normalized=value.lower()
        )
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError("A vehicle with this plate number already exists.")
        return value

    def validate_model_year(self, value):
        if value is not None and not 1980 <= value <= datetime.now(UTC).year + 1:
            raise serializers.ValidationError("Must be between 1980 and next year.")
        return value

    def validate(self, attrs):
        for field in ("display_name", "manufacturer", "model"):
            if field in attrs:
                attrs[field] = attrs[field].strip()
        if self.instance is None and "is_active" in self.initial_data:
            raise serializers.ValidationError({"is_active": "This field is not accepted."})
        if self.instance is not None:
            errors = {}
            if "device_id" in self.initial_data:
                errors["device_id"] = "This field is immutable."
            if "is_active" in self.initial_data:
                errors["is_active"] = "Use the status action."
            if errors:
                raise serializers.ValidationError(errors)
        return attrs
