// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

// Lab 3 (Issue 2): the Development Requester selector is removed. The app
// boots into a session check (GET /api/auth/me) and shows the Login screen
// when signed out. These tests replace the Lab 2 requester-gate assertions
// while keeping the same intent: gate first, then the main app.

const signedOutUser = {
  id: 3,
  name: "Alice Johnson",
  email: "alice@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

const signedInStaffUser = {
  id: 7,
  name: "IT Staff One",
  email: "staff1@company.com",
  role: "IT Staff",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

function mockAuthApi(options: { me: "signed-out" | "signed-in" | "staff" | "forced" }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/auth/me")) {
        if (options.me === "signed-out") {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ success: false, error: { code: "UNAUTHENTICATED", message: "Please sign in." } }),
          });
        }
        const forced = options.me === "forced";
        const user = options.me === "staff" ? signedInStaffUser : signedOutUser;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { user: { ...user, requiresPasswordChange: forced, mustChangePassword: forced } },
          }),
        });
      }

      if (url.includes("/api/auth/login")) {
        const user = options.me === "staff" ? signedInStaffUser : signedOutUser;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { user } }),
        });
      }

      if (url.includes("/api/staff/tickets")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } },
          }),
        });
      }

      if (url.includes("/api/categories")) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 4, name: "Network" }],
        });
      }

      if (url.includes("/api/health")) {
        return Promise.resolve({ ok: true, json: async () => ({ status: "ok" }) });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          tickets: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        }),
      });
    }),
  );
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    // BrowserRouter keeps window history across tests; reset to "/" so each
    // test starts at the app root.
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("asks for login before showing the main app", async () => {
    mockAuthApi({ me: "signed-out" });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "My Tickets" })).not.toBeInTheDocument();
  });

  it("shows the empty My Tickets state after a successful login", async () => {
    mockAuthApi({ me: "signed-out" });
    render(<App />);

    await userEvent.type(await screen.findByLabelText(/Email/), "alice@company.com");
    await userEvent.type(screen.getByPlaceholderText("Your password"), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));

    expect(await screen.findByText("No tickets yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });

  it("navigates to the Create Ticket view", async () => {
    mockAuthApi({ me: "signed-in" });
    render(<App />);

    await screen.findByRole("heading", { name: "My Tickets" });
    await userEvent.click(screen.getByRole("link", { name: /Create Ticket/i }));

    expect(screen.getByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Ticket" })).toBeInTheDocument();
  });

  it("shows the authenticated user with a role badge and logout", async () => {
    mockAuthApi({ me: "signed-in" });
    render(<App />);

    await screen.findByRole("heading", { name: "My Tickets" });

    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("forces a password change before entering the app", async () => {
    mockAuthApi({ me: "forced" });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "My Tickets" })).not.toBeInTheDocument();
  });

  it("lands IT Staff on My Queue with role-specific navigation", async () => {
    mockAuthApi({ me: "staff" });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "My Queue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /My Queue/i })).toBeInTheDocument();
    expect(screen.getByText("IT Staff One")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /My Tickets/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Create Ticket/i })).not.toBeInTheDocument();
  });

  it("hides the staff queue from Requesters", async () => {
    mockAuthApi({ me: "signed-in" });
    render(<App />);

    await screen.findByRole("heading", { name: "My Tickets" });

    expect(screen.queryByRole("link", { name: /My Queue/i })).not.toBeInTheDocument();
  });
});
