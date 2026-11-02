export const ROLES = ["admin", "clinician"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "patients:read",
  "patients:create",
  "patients:update",
  "patients:delete",
  "admissions:read",
  "admissions:create",
  "admissions:update",
  "admissions:delete",
  "clinical:read",
  "clinical:create",
  "clinical:update",
  "clinical:delete",
  "medications:read",
  "medications:create",
  "medications:update",
  "medications:delete",
  "antibiotics:read",
  "antibiotics:create",
  "antibiotics:update",
  "antibiotics:delete",
  "protocols:read",
  "protocols:create",
  "protocols:update",
  "protocols:delete",
  "specialties:read",
  "specialties:manage",
  "transfers:read",
  "transfers:create",
  "transfers:update",
  "transfers:delete",
  "dashboard:read",
  "ai:extract",
  "users:read",
  "users:update",
  "users:manage",
  "profile:read",
  "profile:update",
  "subscriptions:read",
  "subscriptions:manage",
  "reminders:read",
  "reminders:create",
  "reminders:update",
  "reminders:delete",
  "references:read",
  "references:create",
  "references:delete",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const clinicianPermissions: Permission[] = PERMISSIONS.filter(
  (p) =>
    p !== "users:manage" &&
    p !== "specialties:manage" &&
    p !== "protocols:create" &&
    p !== "protocols:update" &&
    p !== "protocols:delete"
);

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [...PERMISSIONS],
  clinician: clinicianPermissions,
};

export const hasPermission = (role: Role, permission: Permission): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};
