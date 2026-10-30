// Canonical role values shared by the UI. These match the backend Prisma enum
// (`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`). The API usually returns display
// labels, so every helper accepts either the raw enum value or a label.
export const UserRole = {
  REQUESTER: "REQUESTER",
  IT_STAFF: "IT_STAFF",
  ADMINISTRATOR: "ADMINISTRATOR",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const USER_ROLE_DISPLAY: Record<UserRole, string> = {
  [UserRole.REQUESTER]: "Requester",
  [UserRole.IT_STAFF]: "IT Staff",
  [UserRole.ADMINISTRATOR]: "Administrator",
};

export const USER_ROLE_VALUES = [
  UserRole.REQUESTER,
  UserRole.IT_STAFF,
  UserRole.ADMINISTRATOR,
] as const;

export function normalizeUserRole(role: unknown): UserRole | null {
  if (typeof role !== "string") return null;

  switch (role.trim().toLowerCase().replace(/[\s_-]+/g, "")) {
    case "requester":
      return UserRole.REQUESTER;
    case "itstaff":
      return UserRole.IT_STAFF;
    case "administrator":
    case "admin":
      return UserRole.ADMINISTRATOR;
    default:
      return null;
  }
}

export function formatRoleDisplay(role: unknown): string {
  const normalized = normalizeUserRole(role);
  if (normalized) return USER_ROLE_DISPLAY[normalized];

  if (typeof role === "string" && role.trim()) return role.trim();
  return "Unknown";
}

export function isStaffRole(role: unknown): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === UserRole.IT_STAFF || normalized === UserRole.ADMINISTRATOR;
}

export function isAdministratorRole(role: unknown): boolean {
  return normalizeUserRole(role) === UserRole.ADMINISTRATOR;
}
