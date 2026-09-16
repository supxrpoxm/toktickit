// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChangePassword from "../../src/ChangePassword";
import type { AuthUser } from "../../src/api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const forcedUser: AuthUser = {
  id: 4,
  name: "Brandon Lee",
  email: "brandon@company.com",
  role: "Requester",
  isActive: true,
  requiresPasswordChange: true,
  mustChangePassword: true,
};

function renderForced(overrides: Partial<React.ComponentProps<typeof ChangePassword>> = {}) {
  return render(
    <ChangePassword
      user={forcedUser}
      mode="forced"
      onChanged={vi.fn()}
      onLogout={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ChangePassword (lab-03)", () => {
  it("explains the forced change and blocks submit on weak input", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderForced();
    expect(screen.getByText(/administrator issued an initial password/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/New password/), "short");
    await userEvent.type(screen.getByLabelText(/Confirm new password/), "short");
    await userEvent.click(screen.getByRole("button", { name: /Save new password/ }));

    expect(await screen.findByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects passwords without a letter and a number", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderForced();
    await userEvent.type(screen.getByLabelText(/New password/), "passwordonly");
    await userEvent.type(screen.getByLabelText(/Confirm new password/), "passwordonly");
    await userEvent.click(screen.getByRole("button", { name: /Save new password/ }));

    expect(await screen.findByText(/at least one letter and one number/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a mismatch message and checks the rule list live", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderForced();

    await userEvent.type(screen.getByLabelText(/New password/), "Newpass123");
    await userEvent.type(screen.getByLabelText(/Confirm new password/), "Other123");

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Save new password/ }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("shows a busy state and continues on success", async () => {
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
                  json: async () => ({ success: true, data: { user: { id: 4 } } }),
                }),
              50,
            ),
          ),
      ),
    );
    const onChanged = vi.fn();
    renderForced({ onChanged });

    await userEvent.type(screen.getByLabelText(/New password/), "Newpass123");
    await userEvent.type(screen.getByLabelText(/Confirm new password/), "Newpass123");
    await userEvent.click(screen.getByRole("button", { name: /Save new password/ }));

    expect(await screen.findByRole("button", { name: /Saving/ })).toHaveProperty("disabled", true);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("surfaces server validation with values preserved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Please fix the highlighted fields.",
            fields: { newPassword: "New password must be different from the current password." },
          },
        }),
      }),
    );

    renderForced();
    await userEvent.type(screen.getByLabelText(/New password/), "Password123!");
    await userEvent.type(screen.getByLabelText(/Confirm new password/), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: /Save new password/ }));

    expect(await screen.findByText(/must be different from the current password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/New password/)).toHaveValue("Password123!");
  });

  it("voluntary mode offers cancel instead of sign-out", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const onCancel = vi.fn();
    render(
      <ChangePassword
        user={{ ...forcedUser, requiresPasswordChange: false, mustChangePassword: false }}
        mode="voluntary"
        onChanged={vi.fn()}
        onCancel={onCancel}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Sign out instead/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
