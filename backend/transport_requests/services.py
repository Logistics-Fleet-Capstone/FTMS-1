from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from .models import (
    TransportRequest,
    TransportRequestNumberSequence,
    TransportRequestStatusHistory,
)


class WorkflowConflict(APIException):
    status_code = 409
    default_code = "workflow_conflict"


TRANSITIONS = {
    "submit": ({TransportRequest.Status.SUBMITTED}, TransportRequest.Status.PENDING_APPROVAL),
    "approve": ({TransportRequest.Status.PENDING_APPROVAL}, TransportRequest.Status.APPROVED),
    "reject": ({TransportRequest.Status.PENDING_APPROVAL}, TransportRequest.Status.REJECTED),
    "request_details": (
        {TransportRequest.Status.PENDING_APPROVAL},
        TransportRequest.Status.MORE_DETAILS_REQUIRED,
    ),
    "resubmit": (
        {TransportRequest.Status.MORE_DETAILS_REQUIRED},
        TransportRequest.Status.PENDING_APPROVAL,
    ),
    "cancel": (
        {TransportRequest.Status.SUBMITTED, TransportRequest.Status.MORE_DETAILS_REQUIRED},
        TransportRequest.Status.CANCELLED,
    ),
}


def next_request_number():
    today = timezone.localdate()
    with transaction.atomic():
        try:
            sequence, _ = TransportRequestNumberSequence.objects.select_for_update().get_or_create(
                date=today
            )
        except IntegrityError:
            sequence = TransportRequestNumberSequence.objects.select_for_update().get(date=today)
        sequence.value += 1
        sequence.save(update_fields=["value"])
        return f"TR-{today:%y%m%d}-{sequence.value:04d}"


@transaction.atomic
def create_request(*, user, validated_data):
    item = TransportRequest.objects.create(
        request_number=next_request_number(), created_by=user, **validated_data
    )
    TransportRequestStatusHistory.objects.create(
        transport_request=item,
        from_status="",
        to_status=item.status,
        action="create",
        performed_by=user,
    )
    return item


@transaction.atomic
def transition_request(*, request_number, action, user, remarks=""):
    item = TransportRequest.objects.select_for_update().get(request_number=request_number)
    allowed, target = TRANSITIONS[action]
    if item.status not in allowed:
        raise WorkflowConflict(
            f"Cannot {action.replace('_', ' ')} a request with status {item.status}."
        )
    previous = item.status
    item.status = target
    item.save(update_fields=["status", "updated_at"])
    TransportRequestStatusHistory.objects.create(
        transport_request=item,
        from_status=previous,
        to_status=target,
        action=action,
        remarks=remarks.strip(),
        performed_by=user,
    )
    return item
