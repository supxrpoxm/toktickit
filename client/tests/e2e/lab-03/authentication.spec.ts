import { expect, test, type Page } from "@playwright/test";

type MockUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  requiresPasswordChange: boolean;
  mustChangePassword: boolean;
};

const VALID_PASSWORD = "Password123!";

const requester: MockUser = {
  id: 3,
  name: "Alice Johnson",
  email: "alice@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

const forcedUser: MockUser = {
  id: 4,
  name: "Brandon Lee",
  email: "brandon@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: true,
  mustChangePassword: true,
};

// Simulates the Lab 3 session API with route mocking: a shared `session`
// variable plays the role of the httpOnly cookie.
async function mockSessionApi(page: Page) {
  let session: MockUser | null = null;

  await page.route("**/api/health", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
  });

  await page.route("**/api/auth/me", async (route) => {
    if (!session) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "UNAUTHENTICATED", message: "Please sign in." } }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { user: session } }) });
  });

  await page.route("**/api/auth/login", async (route) => {
    const payload = JSON.parse(route.request().postData() ?? "{}");

    if (payload.email === "evelyn@company.com") {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: { code: "ACCOUNT_INACTIVE", message: "This account is inactive. Please contact an administrator." },
        }),
      });
      return;
    }

    const known = payload.email === requester.email ? requester : payload.email === forcedUser.email ? forcedUser : null;
    if (!known || payload.password !== VALID_PASSWORD) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
        }),
      });
      return;
    }

    session = { ...known };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { user: session } }) });
  });

  await page.route("**/api/auth/change-password", async (route) => {
    if (!session) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "UNAUTHENTICATED", message: "Please sign in." } }),
      });
      return;
    }
    const payload = JSON.parse(route.request().postData() ?? "{}");
    const next: string = payload.newPassword ?? "";
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Please fix the highlighted fields.", fields: { newPassword: "Password must be at least 8 characters." } },
        }),
      });
      return;
    }
    if (next !== payload.confirmPassword) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Please fix the highlighted fields.", fields: { confirmPassword: "Passwords do not match." } },
        }),
      });
      return;
    }
    session = { ...session, requiresPasswordChange: false, mustChangePassword: false };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { user: { id: session.id, mustChangePassword: false } } }),
    });
  });

  await page.route("**/api/auth/logout", async (route) => {
    session = null;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { loggedOut: true } }),
    });
  });

  await page.route("**/api/tickets**", async (route) => {
    if (!session || session.requiresPasswordChange) {
      await route.fulfill({
        status: session ? 403 : 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: session ? "PASSWORD_CHANGE_REQUIRED" : "UNAUTHENTICATED" } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tickets: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
    });
  });
}

test.describe("lab-03 authentication (E-01)", () => {
  test("valid login enters the app with user name, role badge, and logout", async ({ page }) => {
    await mockSessionApi(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.getByLabel(/Email/).fill("alice@company.com");
    await page.getByPlaceholder("Your password").fill("Password123!");
    await page.getByRole("button", { name: /^Sign in$/ }).click();

    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByText("Alice Johnson")).toBeVisible();
    await expect(page.getByText("Requester")).toBeVisible();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
    // Lab 2 selector is gone.
    await expect(page.getByRole("heading", { name: "Select Requester" })).not.toBeVisible();
  });

  test("invalid login shows the safe generic error and stays on login", async ({ page }) => {
    await mockSessionApi(page);
    await page.goto("/");

    await page.getByLabel(/Email/).fill("alice@company.com");
    await page.getByPlaceholder("Your password").fill("Wrongpass1");
    await page.getByRole("button", { name: /^Sign in$/ }).click();

    await expect(page.getByRole("alert")).toContainText("Invalid email or password.");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Tickets" })).not.toBeVisible();
  });

  test("inactive account shows the inactive notice", async ({ page }) => {
    await mockSessionApi(page);
    await page.goto("/");

    await page.getByLabel(/Email/).fill("evelyn@company.com");
    await page.getByPlaceholder("Your password").fill("Password123!");
    await page.getByRole("button", { name: /^Sign in$/ }).click();

    await expect(page.getByText(/This account is inactive/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Tickets" })).not.toBeVisible();
  });

  test("initial-password login forces a change before entering the app", async ({ page }) => {
    await mockSessionApi(page);
    await page.goto("/");

    await page.getByLabel(/Email/).fill("brandon@company.com");
    await page.getByPlaceholder("Your password").fill("Password123!");
    await page.getByRole("button", { name: /^Sign in$/ }).click();

    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Tickets" })).not.toBeVisible();

    // Weak password is rejected inline.
    await page.getByLabel(/New password/).fill("short");
    await page.getByLabel(/Confirm new password/).fill("short");
    await page.getByRole("button", { name: /Save new password/ }).click();
    await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();

    // Valid password continues into the role landing page.
    await page.getByLabel(/New password/).fill("Newpass123");
    await page.getByLabel(/Confirm new password/).fill("Newpass123");
    await page.getByRole("button", { name: /Save new password/ }).click();

    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByText("Brandon Lee")).toBeVisible();
  });

  test("logout blocks protected screens including direct-URL access", async ({ page }) => {
    await mockSessionApi(page);
    await page.goto("/");

    await page.getByLabel(/Email/).fill("alice@company.com");
    await page.getByPlaceholder("Your password").fill("Password123!");
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("You have been signed out.")).toBeVisible();

    // Direct-URL access after logout returns to login.
    await page.goto("/tickets/new");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("stale Lab 2 requester state is ignored", async ({ page }) => {
    await mockSessionApi(page);
    await page.addInitScript(() => {
      localStorage.setItem("toktickit.requesterId", "1");
    });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Select Requester" })).not.toBeVisible();
  });
});
