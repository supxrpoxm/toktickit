// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RequesterDashboard from "../../src/RequesterDashboard";
import type { RequesterDashboardData } from "../../src/api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function dashboardResponse(data: RequesterDashboardData) {
  return jsonResponse({ success: true, data });
}

const REQUESTER_DATA: RequesterDashboardData = {
  summary: {
    totalTickets: 8,
    openTickets: 2,
    inProgressTickets: 1,
    waitingForRequester: 1,
    resolvedTickets: 2,
    closedTickets: 2,
    cancelledTickets: 0,
  },
  recentTickets: [
    {
      id: 201,
      ticketNumber: "TT-0201",
      title: "Laptop will not boot",
      status: "In Progress",
      requestedPriority: "Medium",
      itPriority: "High",
      owner: { id: 7, name: "IT Staff One" },
      category: "Hardware",
      relatedSystem: "Laptop Fleet",
      updatedAt: "2026-10-29T09:00:00.000Z",
    },
  ],
  latestActions: [
    {
      id: 601,
      ticketId: 201,
      ticketNumber: "TT-0201",
      ticketTitle: "Laptop will not boot",
      summary: "Ordered a replacement battery.",
      details: "Delivery expected in two business days.",
      status: "Open",
      performedBy: { id: 7, name: "IT Staff One", role: "IT Staff" },
      dueAt: null,
      completedAt: null,
      updatedAt: "2026-10-29T10:00:00.000Z",
    },
  ],
  needsAttention: [
    {
      id: 202,
      ticketNumber: "TT-0202",
      title: "Need more information",
      status: "Waiting for Requester",
      requestedPriority: "Low",
      itPriority: "Low",
      owner: { id: 7, name: "IT Staff One" },
      category: "Software",
      updatedAt: "2026-10-28T09:00:00.000Z",
    },
  ],
  generatedAt: "2026-10-29T10:42:00.000Z",
};

describe("RequesterDashboard (Lab 4 Issue 5)", () => {
  it("renders only the requester's summary, tickets, and latest actions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => dashboardResponse(REQUESTER_DATA)));
    const onOpenTicket = vi.fn();
    const onCreateTicket = vi.fn();
    const onOpenMyTickets = vi.fn();

    render(
      <RequesterDashboard
        userName="Alice Johnson"
        onOpenTicket={onOpenTicket}
        onCreateTicket={onCreateTicket}
        onOpenMyTickets={onOpenMyTickets}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Welcome, Alice Johnson" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Total tickets: 8. View matching tickets." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waiting for you: 1. View matching tickets." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolved: 2. View matching tickets." })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Recent Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Needs Your Attention" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Latest Actions Taken" })).toBeInTheDocument();
    expect(screen.getByText("IT is waiting for information from you.")).toBeInTheDocument();
    expect(screen.getByText("Ordered a replacement battery.")).toBeInTheDocument();
    expect(screen.getAllByText("Laptop will not boot").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Internal Notes/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit|complete|cancel|delete/i })).not.toBeInTheDocument();

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/requester/dashboard?limit=5",
      expect.objectContaining({ credentials: "include" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Waiting for you: 1. View matching tickets." }));
    expect(onOpenMyTickets).toHaveBeenCalledWith("Waiting for Requester");

    await userEvent.click(screen.getAllByRole("button", { name: "Open ticket TT-0201" })[0]);
    expect(onOpenTicket).toHaveBeenCalledWith(201);

    await userEvent.click(screen.getByRole("button", { name: "New Ticket" }));
    expect(onCreateTicket).toHaveBeenCalled();
  });

  it("shows the empty-state Create Ticket call to action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        dashboardResponse({
          summary: {
            totalTickets: 0,
            openTickets: 0,
            inProgressTickets: 0,
            waitingForRequester: 0,
            resolvedTickets: 0,
            closedTickets: 0,
            cancelledTickets: 0,
          },
          recentTickets: [],
          latestActions: [],
          needsAttention: [],
          generatedAt: "2026-10-29T10:42:00.000Z",
        }),
      ),
    );
    const onCreateTicket = vi.fn();

    render(
      <RequesterDashboard
        userName="Alice Johnson"
        onOpenTicket={vi.fn()}
        onCreateTicket={onCreateTicket}
        onOpenMyTickets={vi.fn()}
      />,
    );

    expect(await screen.findByRole("heading", { name: /haven't created a ticket yet/i })).toBeInTheDocument();
    expect(screen.getByText("Nothing is waiting on you.")).toBeInTheDocument();
    expect(screen.getByText("No actions have been recorded yet.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create your first ticket" }));
    expect(onCreateTicket).toHaveBeenCalled();
  });

  it("renders a neutral forbidden panel with no ticket data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { success: false, error: { code: "FORBIDDEN", message: "No access." } },
          403,
        ),
      ),
    );

    render(
      <RequesterDashboard
        userName="Alice Johnson"
        onOpenTicket={vi.fn()}
        onCreateTicket={vi.fn()}
        onOpenMyTickets={vi.fn()}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/don't have access/i);
    expect(screen.queryByText("TT-0201")).not.toBeInTheDocument();
    expect(screen.queryByText(/Internal Notes/i)).not.toBeInTheDocument();
  });

  it("shows a safe failure banner and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message: "Boom" } }, 500),
      )
      .mockResolvedValueOnce(dashboardResponse(REQUESTER_DATA));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RequesterDashboard
        userName="Alice Johnson"
        onOpenTicket={vi.fn()}
        onCreateTicket={vi.fn()}
        onOpenMyTickets={vi.fn()}
      />,
    );

    expect(await screen.findByText(/Unable to load your dashboard right now/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Welcome, Alice Johnson" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
