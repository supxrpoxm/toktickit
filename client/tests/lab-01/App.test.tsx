// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

function mockSuccessfulApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/requesters")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 1, name: "Alice Johnson", email: "alice@company.com" },
          ],
        });
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
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("asks for a requester before showing the main app", async () => {
    mockSuccessfulApi();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Select Requester" })).toBeInTheDocument();
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alice Johnson/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "My Tickets" })).not.toBeInTheDocument();
  });

  it("shows the empty My Tickets state after a requester is selected", async () => {
    mockSuccessfulApi();
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: /Alice Johnson/ }));

    expect(await screen.findByText("No tickets yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });

  it("navigates to the Create Ticket view", async () => {
    mockSuccessfulApi();
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: /Alice Johnson/ }));
    await userEvent.click(screen.getByRole("link", { name: /Create Ticket/i }));

    expect(screen.getByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Ticket" })).toBeInTheDocument();
  });

  it("switches requester from the navbar", async () => {
    mockSuccessfulApi();
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: /Alice Johnson/ }));
    await screen.findByRole("heading", { name: "My Tickets" });

    expect(screen.getByLabelText(/Requester/)).toHaveValue("1");
  });
});
