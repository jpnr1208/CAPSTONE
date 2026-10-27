from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.utils import timezone


class Role(models.Model):
    name = models.CharField("código", max_length=30, unique=True)
    label = models.CharField("nombre visible", max_length=80, blank=True)
    permissions_json = models.JSONField("permisos", default=list, blank=True)

    class Meta:
        verbose_name = "rol"
        verbose_name_plural = "roles"
        ordering = ["name"]

    def __str__(self):
        return self.label or self.name


class InsiderUserManager(UserManager):
    """Permite crear usuarios usando el email como identificador."""

    def _create_user(self, username, email, password, **extra_fields):
        email = self.normalize_email(email)
        username = username or email
        return super()._create_user(username, email, password, **extra_fields)

    def create_user(self, email=None, password=None, username=None, **extra_fields):
        return super().create_user(username or email, email, password, **extra_fields)

    def create_superuser(self, email=None, password=None, username=None, **extra_fields):
        return super().create_superuser(username or email, email, password, **extra_fields)


class CustomUser(AbstractUser):
    class Status(models.TextChoices):
        ACTIVO = "ACTIVO", "Activo"
        SUSPENDIDO = "SUSPENDIDO", "Suspendido"
        INACTIVO = "INACTIVO", "Inactivo"

    email = models.EmailField("correo institucional", unique=True)
    rut = models.CharField(max_length=12, blank=True, db_index=True)
    career = models.CharField("carrera", max_length=150, blank=True)
    campus = models.CharField("sede", max_length=100, blank=True)
    role = models.ForeignKey(Role, on_delete=models.PROTECT, null=True, blank=True, related_name="users")
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.ACTIVO)
    created_at = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    objects = InsiderUserManager()

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"
        ordering = ["email"]

    def __str__(self):
        return self.get_full_name() or self.email

    @property
    def role_name(self):
        return self.role.name if self.role else None

    @property
    def permissions(self):
        if self.is_superuser:
            return ["*"]
        return list(self.role.permissions_json) if self.role else []

    def has_role_perm(self, *perms):
        """True si el usuario posee al menos uno de los permisos RBAC indicados."""
        if not self.is_active or self.status != self.Status.ACTIVO:
            return False
        granted = set(self.permissions)
        return "*" in granted or any(p in granted for p in perms)


class PasswordResetCode(models.Model):
    """Código temporal (hash) para recuperación de contraseña."""

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="reset_codes")
    code_hash = models.CharField(max_length=128)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_valid(self):
        return self.used_at is None and self.attempts < 5 and timezone.now() < self.expires_at
