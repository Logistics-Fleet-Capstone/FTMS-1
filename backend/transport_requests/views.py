from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import serializers, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TransportRequest
from .permissions import TransportRequestAccess, TransportRequestWriteAccess
from .serializers import HistorySerializer, RemarksSerializer, TransportRequestSerializer
from .services import transition_request


class TransportRequestPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class TransportRequestListView(APIView):
    permission_classes = [TransportRequestAccess]
    http_method_names = ["get", "post", "options"]

    def get(self, request):
        allowed = {
            "page",
            "page_size",
            "search",
            "status",
            "priority",
            "request_type",
            "scheduled_from",
            "scheduled_to",
            "ordering",
        }
        unknown = set(request.query_params) - allowed
        if unknown:
            raise serializers.ValidationError({key: "Unknown filter." for key in unknown})
        for key in ("page", "page_size"):
            value = request.query_params.get(key)
            if value is not None and (not value.isdigit() or int(value) < 1):
                raise serializers.ValidationError({key: "Must be a positive integer."})
        if int(request.query_params.get("page_size", 20)) > 100:
            raise serializers.ValidationError({"page_size": "Must not exceed 100."})
        queryset = TransportRequest.objects.select_related("created_by")
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(request_number__icontains=search)
                | Q(requester_name__icontains=search)
                | Q(pickup_address__icontains=search)
                | Q(destination_address__icontains=search)
                | Q(external_reference__icontains=search)
            )
        choices = {
            "status": TransportRequest.Status.values,
            "priority": TransportRequest.Priority.values,
            "request_type": TransportRequest.RequestType.values,
        }
        for key, values in choices.items():
            value = request.query_params.get(key)
            if value:
                requested = value.split(",")
                if any(item not in values for item in requested):
                    raise serializers.ValidationError({key: "Invalid value."})
                queryset = queryset.filter(**{f"{key}__in": requested})
        for key, lookup in (
            ("scheduled_from", "scheduled_at__gte"),
            ("scheduled_to", "scheduled_at__lte"),
        ):
            value = request.query_params.get(key)
            if value:
                parsed = parse_datetime(value)
                if parsed is None or parsed.utcoffset() is None:
                    raise serializers.ValidationError({key: "Must be a timezone-aware datetime."})
                queryset = queryset.filter(**{lookup: parsed})
        ordering = request.query_params.get("ordering", "-created_at")
        if ordering.lstrip("-") not in {"created_at", "scheduled_at", "priority", "request_number"}:
            raise serializers.ValidationError({"ordering": "Invalid ordering field."})
        paginator = TransportRequestPagination()
        page = paginator.paginate_queryset(
            queryset.order_by(ordering, "request_number"), request, view=self
        )
        return paginator.get_paginated_response(TransportRequestSerializer(page, many=True).data)

    def post(self, request):
        self._require_write(request)
        serializer = TransportRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _require_write(self, request):
        if not TransportRequestWriteAccess().has_permission(request, self):
            self.permission_denied(request)


class TransportRequestDetailView(APIView):
    permission_classes = [TransportRequestAccess]
    http_method_names = ["get", "patch", "options"]

    def object(self, number):
        return get_object_or_404(
            TransportRequest.objects.select_related("created_by"), request_number=number
        )

    def get(self, request, request_number):
        return Response(TransportRequestSerializer(self.object(request_number)).data)

    def patch(self, request, request_number):
        if not TransportRequestWriteAccess().has_permission(request, self):
            self.permission_denied(request)
        serializer = TransportRequestSerializer(
            self.object(request_number),
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class WorkflowActionView(APIView):
    permission_classes = [TransportRequestAccess, TransportRequestWriteAccess]
    http_method_names = ["post", "options"]
    action = ""
    remarks_required = False

    def post(self, request, request_number):
        if self.remarks_required:
            serializer = RemarksSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            remarks = serializer.validated_data["remarks"]
        else:
            if request.data:
                raise serializers.ValidationError("Request body must be empty.")
            remarks = ""
        item = transition_request(
            request_number=request_number, action=self.action, user=request.user, remarks=remarks
        )
        return Response(TransportRequestSerializer(item).data)


class SubmitView(WorkflowActionView):
    action = "submit"


class ApproveView(WorkflowActionView):
    action = "approve"


class RejectView(WorkflowActionView):
    action = "reject"
    remarks_required = True


class RequestDetailsView(WorkflowActionView):
    action = "request_details"
    remarks_required = True


class ResubmitView(WorkflowActionView):
    action = "resubmit"


class CancelView(WorkflowActionView):
    action = "cancel"


class HistoryView(APIView):
    permission_classes = [TransportRequestAccess]

    def get(self, request, request_number):
        item = get_object_or_404(TransportRequest, request_number=request_number)
        return Response(
            HistorySerializer(item.status_history.select_related("performed_by"), many=True).data
        )
