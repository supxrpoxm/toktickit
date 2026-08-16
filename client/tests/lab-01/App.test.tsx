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
  it.todo("shows Online and the seeded categories on success");

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
