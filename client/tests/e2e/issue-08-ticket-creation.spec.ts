import { expect, test, type Page } from "@playwright/test";

// Lab 3 (Issue 2): the Development Requester selector is removed. These
// Lab 2 regression flows now sign in through the Login screen (mocked
// session API) and prove ticket creation, validation, ownership, attachment,
// and retry behavior work under the authenticated identity.

type MockTicket = {
  id: number;
  createdAt: string;
  title: string;
  status: string;
};

const signedInUser = {
  id: 1,
  name: "Alice Johnson",
  email: "alice@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

async function mockAuthenticatedApi(page: Page, options: { signedIn: boolean } = { signedIn: false }) {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
  });

  await page.route("**/api/auth/me", async (route) => {
    if (!options.signedIn) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "UNAUTHENTICATED", message: "Please sign in." } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { user: signedInUser } }),
    });
  });

  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { user: signedInUser } }),
    });
  });

  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { loggedOut: true } }),
    });
  });
}

async function signIn(page: Page) {
  await page.getByLabel(/Email/).fill("alice@company.com");
  await page.getByPlaceholder("Your password").fill("Password123!");
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
}

async function mockTicketApi(page: Page) {
  await mockAuthenticatedApi(page);
  let tickets: MockTicket[] = [];

  await page.route("**/api/tickets**", async (route) => {
    const request = route.request();

    if (request.method() === "POST" && request.url().endsWith("/api/tickets")) {
      const payload = JSON.parse(request.postData() ?? "{}");
      const createdTicket: MockTicket = {
        id: 1001,
        createdAt: "2026-09-04",
        title: payload.title,
        status: "Open",
      };
      tickets = [createdTicket];

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(createdTicket),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tickets,
        pagination: { page: 1, limit: 10, total: tickets.length, totalPages: 1 },
      }),
    });
  });
}

test.describe("Issue 8 ticket creation", () => {
  test("happy path creates a ticket and shows it in My Tickets", async ({ page }) => {
    await mockTicketApi(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await signIn(page);

    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await page.getByRole("link", { name: /Create Ticket/i }).click();

    await page.getByLabel(/Category/).selectOption("2");
    await page.getByLabel(/Related System/).selectOption("1");
    await page.getByLabel(/Priority/).selectOption("High");
    await page.getByPlaceholder("Briefly describe the request").fill("VPN access request");
    await page.getByPlaceholder("Describe the issue, requested change, or business need.").fill(
      "Remote VPN access is required for the development team.",
    );

    await page.getByRole("button", { name: "Submit Ticket" }).click();

    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByText("VPN access request")).toBeVisible();
    await expect(page.getByText("1001")).toBeVisible();
  });

  test("negative path shows validation errors for empty required fields", async ({ page }) => {
    await mockTicketApi(page);
    await page.goto("/");
    await signIn(page);
    await page.getByRole("link", { name: /Create Ticket/i }).click();

    await page.getByRole("button", { name: "Submit Ticket" }).click();

    await expect(page.getByRole("alert")).toContainText("Please complete all required fields.");
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Tickets" })).not.toBeVisible();
  });

  test("ownership prevention blocks viewing another user's ticket detail", async ({ page }) => {
    await mockAuthenticatedApi(page);

    await page.route("**/api/tickets**", async (route) => {
      const url = route.request().url();

      if (/\/api\/tickets\/\d+/.test(url)) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "Forbidden: you can only access your own tickets." }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tickets: [{ id: 999, createdAt: "2026-09-04", title: "Other user ticket", status: "Open", priority: "High", category: { id: 4, name: "Network" } }],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      });
    });

    await page.goto("/");
    await signIn(page);

    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await page.getByRole("button", { name: "999", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Unauthorized Access" })).toBeVisible();
    await expect(page.getByText("You do not have permission to view this ticket.")).toBeVisible();
    // User stays in the app (not kicked back to login) and can navigate back.
    await expect(page.getByRole("heading", { name: "Sign in" })).not.toBeVisible();
    await page.getByRole("button", { name: /Back to My Tickets/i }).click();
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  });

  test("direct URL access to another user's ticket shows Unauthorized instead of login", async ({ page }) => {
    await mockAuthenticatedApi(page, { signedIn: true });

    await page.route("**/api/tickets**", async (route) => {
      const url = route.request().url();

      if (/\/api\/tickets\/\d+/.test(url)) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "Forbidden: you can only access your own tickets." }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tickets: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        }),
      });
    });

    // An already-authenticated user navigates straight to another user's ticket URL.
    await page.goto("/tickets/999");

    await expect(page).toHaveURL(/\/tickets\/999/);
    await expect(page.getByRole("heading", { name: "Unauthorized Access" })).toBeVisible();
    await expect(page.getByText("You do not have permission to view this ticket.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in" })).not.toBeVisible();
  });

  test("attachment validation shows error for invalid file type", async ({ page }) => {
    await mockAuthenticatedApi(page);

    await page.route("**/api/tickets**", async (route) => {
      const url = route.request().url();

      if (url.includes("/attachments")) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Invalid attachment: JPG, PNG, WEBP, or PDF files up to 5MB are allowed." }),
        });
        return;
      }

      if (/\/api\/tickets\/\d+/.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: 101,
            title: "VPN access",
            description: "Remote access required",
            status: "Open",
            createdAt: "2026-09-04T10:00:00.000Z",
            attachments: [],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tickets: [{ id: 101, createdAt: "2026-09-04", title: "VPN access", status: "Open", priority: "High", category: { id: 4, name: "Network" } }],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      });
    });

    await page.goto("/");
    await signIn(page);
    await page.getByRole("button", { name: "101", exact: true }).click();

    await expect(page.getByRole("heading", { name: "VPN access" })).toBeVisible();

    const fixtureUrl = new URL("./fixtures/invalid-file.exe", import.meta.url);
    await page.locator("#ticket-attachments").setInputFiles(
      decodeURIComponent(fixtureUrl.pathname).replace(/^\//, ""),
    );

    await expect(page.getByText(/Only JPG, PNG, WEBP, and PDF files up to 5MB/)).toBeVisible();
  });

  test("empty state and retry flow recovers from API failure", async ({ page }) => {
    await mockAuthenticatedApi(page);
    let callCount = 0;

    await page.route("**/api/tickets*", async (route) => {
      callCount++;
      // Fail the first two calls: React StrictMode mounts the effect twice in dev,
      // so both initial fetches must fail for the error state to stick.
      if (callCount <= 2) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tickets: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        }),
      });
    });

    await page.goto("/");
    await signIn(page);

    await expect(page.getByText("Unable to load tickets right now.")).toBeVisible();

    await page.getByRole("button", { name: /Try again/i }).click();

    await expect(page.getByText("No tickets yet")).toBeVisible();
    await expect(page.getByText(/You do not have any tickets yet/)).toBeVisible();
  });
});
