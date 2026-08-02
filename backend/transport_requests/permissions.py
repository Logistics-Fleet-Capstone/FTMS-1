from rest_framework.permissions import BasePermission

from accounts.models import StaffProfile
from accounts.roles import SUPER_ADMIN, resolve_role

WRITER_ROLES = {SUPER_ADMIN, StaffProfile.Role.FLEET_MANAGER}


class TransportRequestAccess(BasePermission):
    def has_permission(self, request, view):
        return resolve_role(request.user) is not None


class TransportRequestWriteAccess(BasePermission):
    def has_permission(self, request, view):
        return resolve_role(request.user) in WRITER_ROLES
