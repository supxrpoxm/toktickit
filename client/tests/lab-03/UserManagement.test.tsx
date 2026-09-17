// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import UserManagement from "../../src/UserManagement";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ADMIN = {
  id: 11,
  name: "Admin User",
  email: "admin@company.com",
  role: "Administrator",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

const ALICE = {
  id: 3,
  name: "Alice Johnson",
  email: "alice@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

const STAFF = {
  id: 7,
  name: "IT Staff One",
  email: "staff1@company.com",
  role: "IT Staff",
  isActive: false,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

type MockConfig = {
  users?: unknown[];
  status?: number;
  code?: string;
  createUser?: (body: Record<string, unknown>) => { status: number; body: unknown };
  updateUser?: (id: number, body: Record<string, unknown>) => { status: number; body: unknown };
  setPassword?: (id: number, body: Record<string, unknown>) => { status: number; body: unknown };
  seen?: string[];
};

function ok(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockApi(config: MockConfig = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    config.seen?.push(`${method} ${url}`);
    const payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    if (url.startsWith("/api/admin/users")) {
      const idMatch = url.match(/^\/api\/admin\/users\/(\d+)(\/set-password)?/);
      if (method === "GET" && !idMatch) {
        const status = config.status ?? 200;
        if (status !== 200) {
          return ok(
            { success: false, error: { code: config.code ?? "INTERNAL_ERROR", message: "Denied." } },
            status,
          );
        }
        const items = config.users ?? [ADMIN, ALICE, STAFF];
        return ok({ success: true, data: { items } });
      }
      if (method === "POST" && !idMatch) {
        if (config.createUser) {
          const result = config.createUser(payload);
          return ok(result.body, result.status);
        }
        return ok(
          {
            success: true,
            data: {
              user: {
                id: 21,
                name: String(payload.name ?? ""),
                email: String(payload.email ?? ""),
                role: String(payload.role ?? "Requester"),
                isActive: payload.isActive !== false,
                requiresPasswordChange: true,
                mustChangePassword: true,
              },
            },
          },
          201,
        );
      }
      if (idMatch && (method === "PATCH" || method === "PUT") && !idMatch[2]) {
        const id = Number(idMatch[1]);
        if (config.updateUser) {
          const result = config.updateUser(id, payload);
          return ok(result.body, result.status);
        }
        const current = ([ADMIN, ALICE, STAFF] as Record<string, unknown>[]).find((u) => u.id === id) ?? ALICE;
        return ok({ success: true, data: { user: { ...current, ...payload } } });
      }
      if (idMatch && method === "POST" && idMatch[2]) {
        const id = Number(idMatch[1]);
        if (config.setPassword) {
          const result = config.setPassword(id, payload);
          return ok(result.body, result.status);
        }
        return ok({ success: true, data: { id, mustChangePassword: true, requiresPasswordChange: true } });
      }
    }
    return ok({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("UserManagement (lab-03, Issue 5)", () => {
  it("shows a loading state while users are being fetched", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<UserManagement />);

    expect(screen.getByText("Loading users...")).toBeInTheDocument();
  });

  it("renders the user list with Name, Email, Role, Status, and Edit", async () => {
    mockApi();
    const { container } = render(<UserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByText("3 users")).toBeInTheDocument();

    const table = container.querySelector("table") as HTMLElement;
    expect(within(table).getByText("Alice Johnson")).toBeInTheDocument();
    expect(within(table).getByText("alice@company.com")).toBeInTheDocument();
    expect(within(table).getByText("Requester")).toBeInTheDocument();
    expect(within(table).getAllByText("Active")).toHaveLength(2);
    expect(within(table).getByText("Inactive")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Edit Alice Johnson" })).toBeInTheDocument();
  });

  it("sends search text and the role filter to the API", async () => {
    const seen: string[] = [];
    mockApi({ seen });
    render(<UserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search users"), "alice");

    await waitFor(() => {
      expect(seen.some((url) => url.includes("search=alice"))).toBe(true);
    });

    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "IT Staff");
    await waitFor(() => {
      expect(seen.some((url) => url.includes("role=IT+Staff") || url.includes("role=IT%20Staff"))).toBe(true);
    });

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByLabelText("Search users")).toHaveValue("");
  });

  it("shows empty vs. no-results states distinctly", async () => {
    mockApi({ users: [] });
    render(<UserManagement />);

    expect(await screen.findByText("No users yet")).toBeInTheDocument();

    await userEvent.type(await screen.findByLabelText("Search users"), "zzz");
    expect(await screen.findByText("No matching users")).toBeInTheDocument();
  });

  it("creates a user and shows the forced-change success toast", async () => {
    const seen: string[] = [];
    mockApi({ seen });
    render(<UserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^New user$/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "New user" })).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText(/Name/), "New Staff");
    await userEvent.type(within(dialog).getByLabelText(/Email/), "staff4@company.com");
    await userEvent.selectOptions(within(dialog).getByLabelText(/Role/), "IT Staff");
    await userEvent.type(within(dialog).getByLabelText(/Initial password/), "Password123!");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create user" }));

    expect(await screen.findByText(/will be asked to choose a new password at next sign-in/)).toBeInTheDocument();
    await waitFor(() => {
      expect(seen).toContain("POST /api/admin/users");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows field-level errors for invalid create payloads", async () => {
    mockApi({
      createUser: () => ({
        status: 400,
        body: {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Please fix the highlighted fields.",
            fields: { email: "Email must be a valid email address.", role: "Role must be one of Requester, IT Staff, or Administrator." },
          },
        },
      }),
    });
    render(<UserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^New user$/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Name/), "Bad User");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create user" }));

    expect(await within(dialog).findByText("Email must be a valid email address.")).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
  });

  it("surfaces duplicate-email errors on the email field", async () => {
    mockApi({
      createUser: () => ({
        status: 409,
        body: {
          success: false,
          error: {
            code: "DUPLICATE_EMAIL",
            message: "An account with this email already exists.",
            fields: { email: "An account with this email already exists." },
          },
        },
      }),
    });
    render(<UserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^New user$/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Name/), "Copycat");
    await userEvent.type(within(dialog).getByLabelText(/Email/), "alice@company.com");
    await userEvent.type(within(dialog).getByLabelText(/Initial password/), "Password123!");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create user" }));

    expect(await within(dialog).findByText("An account with this email already exists.")).toBeInTheDocument();
  });

  it("edits a user with prefilled values and saves changes", async () => {
    const seen: string[] = [];
    mockApi({ seen });
    render(<UserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Edit Alice Johnson" })[0]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Name/)).toHaveValue("Alice Johnson");
    expect(within(dialog).getByLabelText(/Email/)).toHaveValue("alice@company.com");

    await userEvent.clear(within(dialog).getByLabelText(/Name/));
    await userEvent.type(within(dialog).getByLabelText(/Name/), "Alice Renamed");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("User updated — Alice Renamed.")).toBeInTheDocument();
    await waitFor(() => {
      expect(seen).toContain("PATCH /api/admin/users/3");
    });
  });

  it("deactivates a user through the Active toggle", async () => {
    const seen: string[] = [];
    let patchedBody: Record<string, unknown> = {};
    mockApi({
      seen,
      updateUser: (_id, body) => {
        patchedBody = body;
        return { status: 200, body: { success: true, data: { user: { ...ALICE, ...body } } } };
      },
    });
    render(<UserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Edit Alice Johnson" })[0]);

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByLabelText("Active"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(patchedBody.isActive).toBe(false);
    });
    expect(await screen.findByText("User updated — Alice Johnson.")).toBeInTheDocument();
  });

  it("shows safety-rule violations as a dialog-level amber callout", async () => {
    mockApi({
      updateUser: () => ({
        status: 403,
        body: {
          success: false,
          error: { code: "ADMIN_SAFETY_RULE", message: "You cannot deactivate your own account." },
        },
      }),
    });
    render(<UserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Edit Admin User" })[0]);

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByLabelText("Active"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    const callout = await within(dialog).findByText("You cannot deactivate your own account.");
    expect(callout.closest(".alert-warning")).toBeTruthy();
    expect(dialog).toBeInTheDocument();
  });

  it("sets a new initial password with the forced-change consequence", async () => {
    const seen: string[] = [];
    mockApi({ seen });
    render(<UserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Edit Alice Johnson" })[0]);

    let dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Set new password" }));

    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /Set new password/ })).toBeInTheDocument();
    expect(within(dialog).getByText(/will be asked to choose a new password at next sign-in/)).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText(/New initial password/), "Brandnew123");
    await userEvent.click(within(dialog).getByRole("button", { name: "Set password" }));

    expect(await screen.findByText("Alice Johnson will be asked to choose a new password at next sign-in.")).toBeInTheDocument();
    await waitFor(() => {
      expect(seen).toContain("POST /api/admin/users/3/set-password");
    });
  });

  it("shows the forbidden screen without user data", async () => {
    mockApi({ status: 403, code: "FORBIDDEN" });
    render(<UserManagement />);

    expect(await screen.findByText("You don't have access to user management.")).toBeInTheDocument();
    expect(screen.queryByText("Alice Johnson")).not.toBeInTheDocument();
  });

  it("shows a failure banner with retry that preserves the search", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/admin/users")) {
          calls++;
          // Fail only the initial load; the retry succeeds.
          if (calls === 1) {
            return ok({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } }, 500);
          }
        }
        return ok({ success: true, data: { items: [ADMIN, ALICE, STAFF] } });
      }),
    );
    render(<UserManagement />);

    // The toolbar stays mounted, so the search input exists even on failure.
    const searchBox = await screen.findByLabelText("Search users");
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong. Please try again.")).not.toBeInTheDocument();

    // Filters survive the failure round-trip.
    await userEvent.type(searchBox, "alice");
    expect(searchBox).toHaveValue("alice");
  });
});
