from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(trim_whitespace=False)
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields) if hasattr(data, "keys") else set()
        if unknown:
            raise serializers.ValidationError(
                {field: ["Unknown field."] for field in sorted(unknown)}
            )
        return super().to_internal_value(data)
