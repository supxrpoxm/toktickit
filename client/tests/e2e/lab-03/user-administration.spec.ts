import { expect, test, type Page, type Route } from "@playwright/test";

// Lab 3 (Issue 5) E2E: Administrator User Management — search/filter,
// create (incl. duplicate rejection), edit/deactivate, safety rules, and the
// initial-password reset flow ending in a forced password change.

const ADMIN = {
  id: 11,
  name: "Admin User",
  email: "admin@company.com",
  role: "Administrator" as const,
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

const REQUESTER = {
  id: 3,
  name: "Alice Johnson",
  email: "alice@company.com",
  role: "Requester" as const,
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

const STAFF = {
  id: 7,
  name: "IT Staff One",
  email: "staff1@company.com",
  role: "IT Staff" as const,
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

type Role = "Requester" | "IT Staff" | "Administrator";

type WorldUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  requiresPasswordChange: boolean;
  mustChangePassword: boolean;
};

type World = { users: WorldUser[]; nextId: number };

function freshWorld(): World {
  return {
    nextId: 21,
    users: [
      { ...ADMIN },
      { ...REQUESTER },
      { ...STAFF },
      { id: 12, name: "Second Admin", email: "admin2@company.com", role: "Administrator", isActive: true, requiresPasswordChange: false, mustChangePassword: false },
    ],
  };
}

function toLabel(role: string): string {
  return role === "IT_STAFF" ? "IT Staff" : role === "ADMINISTRATOR" ? "Administrator" : "Requester";
}

function toValue(role: string): "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR" {
  const normalized = role.trim().toLowerCase();
  if (normalized === "it staff" || normalized === "it_staff") return "IT_STAFF";
  if (normalized === "administrator") return "ADMINISTRATOR";
  return "REQUESTER";
}

async function fulfill(route: Route, status: number, body: unknown) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

type Session = typeof ADMIN | typeof REQUESTER | typeof STAFF | (typeof REQUESTER & { requiresPasswordChange: boolean; mustChangePassword: boolean });

async function mockWorld(page: Page, session: Session | null, world: World) {
  await page.unrouteAll({ behavior: "wait" });

  await page.route("**/api/health", (route) => fulfill(route, 200, { status: "ok" }));
  await page.route("**/api/auth/me", (route) => {
    if (!session) {
      return fulfill(route, 401, { success: false, error: { code: "UNAUTHENTICATED", message: "Please sign in." } });
    }
    return fulfill(route, 200, { success: true, data: { user: session } });
  });
  await page.route("**/api/categories", (route) => fulfill(route, 200, []));

  await page.route("**/api/admin/users**", async (route) => {
    const sessionRole = session?.role ?? "";
    if (sessionRole !== "Administrator") {
      await fulfill(route, session ? 403 : 401, {
        success: false,
        error: { code: session ? "FORBIDDEN" : "UNAUTHENTICATED", message: "No access." },
      });
      return;
    }
    const url = new URL(route.request().url());
    const method = route.request().method();
    const match = url.pathname.match(/^\/api\/admin\/users\/(\d+)(\/set-password)?$/);

    if (!match && method === "GET") {
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const roleParam = url.searchParams.get("role") ?? "";
      let rows = world.users;
      if (search) {
        rows = rows.filter(
          (u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search),
        );
      }
      if (roleParam) {
        rows = rows.filter((u) => u.role === roleParam);
      }
      const items = [...rows]
        .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
        .map((u) => ({ ...u, role: toLabel(u.role) }));
      await fulfill(route, 200, { success: true, data: { items } });
      return;
    }

    if (!match && method === "POST") {
      const body = route.request().postDataJSON() as {
        name?: string; email?: string; role?: string; isActive?: boolean; initialPassword?: string;
      };
      const email = (body.email ?? "").trim().toLowerCase();
      if (!body.name?.trim() || !/.+@.+\..+/.test(email) || !body.role || (body.initialPassword ?? "").length < 8) {
        await fulfill(route, 400, {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Please fix the highlighted fields.", fields: { email: "Email must be a valid email address." } },
        });
        return;
      }
      if (world.users.some((u) => u.email.toLowerCase() === email)) {
        await fulfill(route, 409, {
          success: false,
          error: { code: "DUPLICATE_EMAIL", message: "An account with this email already exists.", fields: { email: "An account with this email already exists." } },
        });
        return;
      }
      const created: WorldUser = {
        id: world.nextId++,
        name: body.name.trim(),
        email,
        role: toValue(body.role) as Role,
        isActive: body.isActive !== false,
        requiresPasswordChange: true,
        mustChangePassword: true,
      };
      world.users.push(created);
      await fulfill(route, 201, { success: true, data: { user: { ...created, role: toLabel(created.role) } } });
      return;
    }

    if (match && (method === "PATCH" || method === "PUT") && !match[2]) {
      const id = Number(match[1]);
      const target = world.users.find((u) => u.id === id);
      if (!target) {
        await fulfill(route, 404, { success: false, error: { code: "NOT_FOUND", message: "Missing." } });
        return;
      }
      const body = route.request().postDataJSON() as {
        name?: string; email?: string; role?: string; isActive?: boolean;
      };
      if (target.id === session!.id && body.isActive === false) {
        await fulfill(route, 403, {
          success: false,
          error: { code: "ADMIN_SAFETY_RULE", message: "You cannot deactivate your own account." },
        });
        return;
      }
      const nextRole = body.role !== undefined ? toValue(body.role) : target.role;
      const nextActive = body.isActive !== undefined ? body.isActive : target.isActive;
      const leavesCircle = target.role === "Administrator" && target.isActive &&
        (nextActive === false || nextRole !== "Administrator");
      if (leavesCircle && !world.users.some((u) => u.id !== target.id && u.role === "Administrator" && u.isActive)) {
        await fulfill(route, 409, {
          success: false,
          error: { code: "ADMIN_SAFETY_RULE", message: "The system must retain at least one active Administrator." },
        });
        return;
      }
      if (body.email !== undefined) {
        const email = body.email.trim().toLowerCase();
        if (world.users.some((u) => u.id !== target.id && u.email.toLowerCase() === email)) {
          await fulfill(route, 409, {
            success: false,
            error: { code: "DUPLICATE_EMAIL", message: "An account with this email already exists.", fields: { email: "An account with this email already exists." } },
          });
          return;
        }
        target.email = email;
      }
      if (body.name !== undefined) target.name = body.name.trim();
      if (body.role !== undefined) target.role = nextRole as Role;
      if (body.isActive !== undefined) target.isActive = body.isActive;
      await fulfill(route, 200, { success: true, data: { user: { ...target, role: toLabel(target.role) } } });
      return;
    }

    if (match && method === "POST" && match[2]) {
      const id = Number(match[1]);
      const target = world.users.find((u) => u.id === id);
      if (!target) {
        await fulfill(route, 404, { success: false, error: { code: "NOT_FOUND", message: "Missing." } });
        return;
      }
      const body = route.request().postDataJSON() as { initialPassword?: string };
      if ((body.initialPassword ?? "").length < 8) {
        await fulfill(route, 400, {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Please fix the highlighted fields.", fields: { initialPassword: "Initial password must be at least 8 characters." } },
        });
        return;
      }
      target.requiresPasswordChange = true;
      target.mustChangePassword = true;
      await fulfill(route, 200, { success: true, data: { id, mustChangePassword: true, requiresPasswordChange: true } });
      return;
    }

    await fulfill(route, 404, { success: false, error: { code: "NOT_FOUND", message: "Missing." } });
  });
}

test.describe("lab-03 user administration (E-03)", () => {
  test("admin lands on User Management with the list and role nav", async ({ page }) => {
    await mockWorld(page, ADMIN, freshWorld());
    await page.goto("/");

    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    const table = page.locator("table");
    await expect(table.getByText("Alice Johnson")).toBeVisible();
    await expect(table.getByText("admin2@company.com")).toBeVisible();
    await expect(page.getByRole("link", { name: /User Management/ })).toBeVisible();
    // Requester destinations are hidden for admins.
    await expect(page.getByRole("link", { name: /My Tickets/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /Create Ticket/i })).not.toBeVisible();
  });

  test("search and role filter narrow the list and clearing restores it", async ({ page }) => {
    await mockWorld(page, ADMIN, freshWorld());
    await page.goto("/admin/users");
    const table = page.locator("table");

    await expect(table.getByText("Alice Johnson")).toBeVisible();
    await page.getByLabel("Search users").fill("alice");
    await expect(page.getByText("1 of 4 shown")).toBeVisible();
    await expect(table.getByText("IT Staff One")).not.toBeVisible();

    await page.getByLabel("Search users").fill("");
    await page.getByLabel("Filter by role").selectOption("IT Staff");
    await expect(table.getByText("IT Staff One")).toBeVisible();
    await expect(table.getByText("Alice Johnson")).not.toBeVisible();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(table.getByText("Alice Johnson")).toBeVisible();
  });

  test("create user succeeds, duplicate email is rejected in place", async ({ page }) => {
    await mockWorld(page, ADMIN, freshWorld());
    await page.goto("/admin/users");

    await expect(page.locator("table").getByText("Alice Johnson")).toBeVisible();
    await page.getByRole("button", { name: /^New user$/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Name/).fill("New Staff");
    await dialog.getByLabel(/Email/).fill("staff4@company.com");
    await dialog.getByLabel(/Role/).selectOption("IT Staff");
    await dialog.getByLabel(/Initial password/).fill("Password123!");
    await dialog.getByRole("button", { name: "Create user" }).click();

    await expect(page.getByText(/will be asked to choose a new password at next sign-in/)).toBeVisible();
    await expect(page.locator("table").getByText("staff4@company.com")).toBeVisible();

    // Duplicate (case variant) is rejected with a field-level message.
    await page.getByRole("button", { name: /^New user$/ }).click();
    const retry = page.getByRole("dialog");
    await retry.getByLabel(/Name/).fill("Copycat");
    await retry.getByLabel(/Email/).fill("ALICE@company.com");
    await retry.getByLabel(/Initial password/).fill("Password123!");
    await retry.getByRole("button", { name: "Create user" }).click();
    await expect(retry.getByText("An account with this email already exists.")).toBeVisible();
  });

  test("edit and deactivation persist; self-deactivation is blocked", async ({ page }) => {
    await mockWorld(page, ADMIN, freshWorld());
    await page.goto("/admin/users");

    await expect(page.locator("table").getByText("Alice Johnson")).toBeVisible();
    await page.getByRole("button", { name: "Edit Alice Johnson" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Name/).fill("Alice Renamed");
    await dialog.getByLabel("Active").uncheck();
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("User updated — Alice Renamed.")).toBeVisible();
    await expect(page.locator("table").getByText("Inactive")).toBeVisible();

    // Self-deactivation is rejected with the safety rule; nothing mutates.
    await page.getByRole("button", { name: "Edit Admin User" }).first().click();
    const selfDialog = page.getByRole("dialog");
    await selfDialog.getByLabel("Active").uncheck();
    await selfDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(selfDialog.getByText("You cannot deactivate your own account.")).toBeVisible();
  });

  test("last active Administrator cannot be demoted or deactivated", async ({ page }) => {
    const world = freshWorld();
    // Only one active admin remains after removing the second.
    world.users = world.users.filter((u) => u.id !== 12);
    await mockWorld(page, ADMIN, world);
    await page.goto("/admin/users");

    await expect(page.locator("table").getByText("Alice Johnson")).toBeVisible();
    await page.getByRole("button", { name: "Edit Admin User" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Role/).selectOption("IT Staff");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog.getByText("The system must retain at least one active Administrator.")).toBeVisible();
  });

  test("password reset forces a change at next login", async ({ page }) => {
    const world = freshWorld();
    await mockWorld(page, ADMIN, world);
    await page.goto("/admin/users");

    await expect(page.locator("table").getByText("Alice Johnson")).toBeVisible();
    await page.getByRole("button", { name: "Edit Alice Johnson" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Set new password" }).click();
    await dialog.getByLabel(/New initial password/).fill("Brandnew123");
    await dialog.getByRole("button", { name: "Set password" }).click();

    await expect(page.getByText("Alice Johnson will be asked to choose a new password at next sign-in.")).toBeVisible();

    // Signing in as Alice now lands on the forced Change Password screen.
    await mockWorld(page, {
      ...REQUESTER,
      requiresPasswordChange: true,
      mustChangePassword: true,
    }, world);
    await page.goto("/");
    await expect(page).toHaveURL(/\/change-password/);
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await expect(page.getByText("Your administrator issued an initial password.")).toBeVisible();
  });

  test("non-admins get the forbidden screen with no user data", async ({ page }) => {
    await mockWorld(page, REQUESTER, freshWorld());
    await page.goto("/admin/users");

    await expect(page.getByText("You don't have access to this area.")).toBeVisible();
    // No user table or other users' data leaks to unauthorized roles.
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.getByText("admin2@company.com")).not.toBeVisible();

    await mockWorld(page, STAFF, freshWorld());
    await page.goto("/admin/users");
    await expect(page.getByText("You don't have access to this area.")).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.getByText("admin2@company.com")).not.toBeVisible();
  });
});

