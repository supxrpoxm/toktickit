// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Login from "../../src/Login";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const validUser = {
  id: 3,
  name: "Alice Johnson",
  email: "alice@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
};

function mockLoginOnce(response: { ok: boolean; status?: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 401),
      json: async () => response.body,
    }),
  );
}

describe("Login (lab-03)", () => {
  it("validates empty fields inline without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<Login onSuccess={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));

    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates the email shape without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<Login onSuccess={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Email/), "not-an-email");
    await userEvent.type(screen.getByPlaceholderText("Your password"), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a busy state and calls onSuccess on valid login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ success: true, data: { user: validUser } }),
                }),
              50,
            ),
          ),
      ),
    );
    const onSuccess = vi.fn();

    render(<Login onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText(/Email/), "alice@company.com");
    await userEvent.type(screen.getByPlaceholderText("Your password"), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));

    expect(await screen.findByRole("button", { name: /Signing in/ })).toHaveProperty("disabled", true);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(validUser));
  });

  it("shows the same safe generic error for invalid credentials", async () => {
    mockLoginOnce({
      ok: false,
      status: 401,
      body: { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } },
    });

    render(<Login onSuccess={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Email/), "alice@company.com");
    await userEvent.type(screen.getByPlaceholderText("Your password"), "Wrongpass1");
    await userEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Invalid email or password.");
    // Values are preserved for retry.
    expect(screen.getByLabelText(/Email/)).toHaveValue("alice@company.com");
    expect(screen.getByRole("button", { name: /^Sign in$/ })).not.toHaveProperty("disabled", true);
  });

  it("handles inactive accounts with a distinct notice and no success callback", async () => {
    mockLoginOnce({
      ok: false,
      status: 403,
      body: {
        success: false,
        error: { code: "ACCOUNT_INACTIVE", message: "This account is inactive. Please contact an administrator." },
      },
    });
    const onSuccess = vi.fn();

    render(<Login onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText(/Email/), "evelyn@company.com");
    await userEvent.type(screen.getByPlaceholderText("Your password"), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));

    expect(await screen.findByText(/This account is inactive/)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows a retryable message on network failure with values preserved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    render(<Login onSuccess={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Email/), "alice@company.com");
    await userEvent.type(screen.getByPlaceholderText("Your password"), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));

    expect(await screen.findByText(/Unable to reach the server/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveValue("alice@company.com");
  });

  it("toggles password visibility with an accessible label", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<Login onSuccess={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: "Show password" });
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });
});
