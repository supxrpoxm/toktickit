import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

describe("App", () => {
  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  // Issue 4 — write these yourself. Hint: mock the api module with
  // vi.spyOn(api, "checkSystem").mockResolvedValue(...) / .mockRejectedValue(...)
  // then click the button and assert the Online list / Offline message.
  it("shows Online and the seeded categories on success", async () => {
    const categories = [
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 3, name: "Software" },
    ];

    // Mock fetch to return successful health then categories
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(() => {
      call += 1;
      if (call === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ status: "ok", service: "TokTickIT API" }) });
      }
      return Promise.resolve({ ok: true, json: async () => categories });
    }));

    render(<App />);

    const user = userEvent.setup();
    const btn = screen.getByRole("button", { name: /Check System/i });
    await user.click(btn);

    // Online alert
    const online = await screen.findByText(/Online — TokTickIT API is reachable/i);
    expect(online).toBeInTheDocument();

    // Category list items
    for (const c of categories) {
      expect(screen.getByText(c.name)).toBeInTheDocument();
    }
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    // mock fetch to simulate network failure
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network failure"))));

    render(<App />);

    const user = userEvent.setup();
    const btn = screen.getByRole("button", { name: /Check System/i });
    await user.click(btn);

    // The App displays an alert with 'Offline' on error
    const alert = await screen.findByText(/Offline — could not reach the TokTickIT API/i);
    expect(alert).toBeInTheDocument();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
