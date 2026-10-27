from rest_framework.permissions import BasePermission


def RolePermission(*perms):
    """Fábrica de clases DRF: exige al menos uno de los permisos RBAC indicados."""

    class _RolePermission(BasePermission):
        message = "No tienes permisos para realizar esta acción."

        def has_permission(self, request, view):
            user = request.user
            return bool(user and user.is_authenticated and user.has_role_perm(*perms))

    _RolePermission.__name__ = "RolePermission_" + "_".join(p.replace(".", "_") for p in perms)
    return _RolePermission
