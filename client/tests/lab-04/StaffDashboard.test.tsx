// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import StaffDashboard from "../../src/StaffDashboard";
import type { StaffDashboardData } from "../../src/api";

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

function dashboardResponse(data: StaffDashboardData) {
  return jsonResponse({ success: true, data });
}

const STAFF_DATA: StaffDashboardData = {
  summary: {
    myOpenTickets: 4,
    unassignedTickets: 2,
    inProgressTickets: 3,
    waitingForRequester: 1,
    requesterResolvedTickets: 1,
    incompleteActions: 5,
    overdueActions: 2,
  },
  myWork: [
    {
      id: 101,
      ticketNumber: "TT-0101",
      title: "Cannot login to VPN",
      status: "In Progress",
      requestedPriority: "High",
      itPriority: "High",
      owner: { id: 7, name: "IT Staff One" },
      requester: { id: 3, name: "Alice Johnson" },
      category: "Network",
      relatedSystem: "VPN Gateway",
      incompleteActionCount: 1,
      overdueActionCount: 1,
      updatedAt: "2026-10-29T09:00:00.000Z",
    },
  ],
  unassigned: [
    {
      id: 102,
      ticketNumber: "TT-0102",
      title: "Printer offline",
      status: "New",
      requestedPriority: "Medium",
      itPriority: "Medium",
      owner: null,
      category: "Hardware",
      updatedAt: "2026-10-28T09:00:00.000Z",
    },
  ],
  attention: [
    {
      id: 103,
      ticketNumber: "TT-0103",
      title: "Mailbox quota",
      status: "Waiting for Requester",
      requestedPriority: "Low",
      itPriority: "Low",
      owner: { id: 7, name: "IT Staff One" },
      requesterResolved: true,
      category: "Software",
      attentionReasons: ["Requester says resolved", "Overdue action"],
      updatedAt: "2026-10-27T09:00:00.000Z",
    },
  ],
  recentActions: [
    {
      id: 501,
      ticketId: 101,
      ticketNumber: "TT-0101",
      ticketTitle: "Cannot login to VPN",
      summary: "Reset the VPN gateway certificate binding.",
      details: "Requester can connect again.",
      status: "Open",
      performedBy: { id: 7, name: "IT Staff One", role: "IT Staff" },
      dueAt: null,
      completedAt: null,
      updatedAt: "2026-10-29T10:00:00.000Z",
    },
  ],
  generatedAt: "2026-10-29T10:42:00.000Z",
};

describe("StaffDashboard (Lab 4 Issue 5)", () => {
  it("renders KPIs, panels, and drill-down callbacks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => dashboardResponse(STAFF_DATA)));
    const onOpenTicket = vi.fn();
    const onOpenQueue = vi.fn();

    render(<StaffDashboard onOpenTicket={onOpenTicket} onOpenQueue={onOpenQueue} />);

    expect(await screen.findByRole("heading", { name: "IT Staff Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My open tickets: 4. Open filtered queue." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Unassigned: 2. Open filtered queue." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Incomplete actions: 5. Open filtered queue." })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "My Work" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Needs Attention" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unassigned Triage" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent Actions" })).toBeInTheDocument();

    expect(screen.getAllByText("Requester says resolved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Reset the VPN gateway certificate binding.")).toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/staff/dashboard?window=7d&limit=5",
      expect.objectContaining({ credentials: "include" }),
    );

    await userEvent.click(screen.getByRole("link", { name: "My open tickets: 4. Open filtered queue." }));
    expect(onOpenQueue).toHaveBeenCalledWith({ owner: "me" });

    await userEvent.click(screen.getAllByRole("button", { name: "Open ticket TT-0101" })[0]);
    expect(onOpenTicket).toHaveBeenCalledWith(101);
  });

  it("applies search and filter values to the queue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => dashboardResponse(STAFF_DATA)));
    const onOpenQueue = vi.fn();

    render(<StaffDashboard onOpenTicket={vi.fn()} onOpenQueue={onOpenQueue} />);
    await screen.findByRole("heading", { name: "IT Staff Dashboard" });

    const searchBar = screen.getByRole("search", { name: "Search and filter tickets" });
    await userEvent.type(within(searchBar).getByLabelText("Keyword"), "vpn");
    await userEvent.selectOptions(within(searchBar).getByLabelText("Status"), "In Progress");
    await userEvent.selectOptions(within(searchBar).getByLabelText("Priority"), "High");
    await userEvent.type(within(searchBar).getByLabelText("Department"), "Network");
    await userEvent.click(within(searchBar).getByRole("button", { name: "Search queue" }));

    expect(onOpenQueue).toHaveBeenCalledWith({
      search: "vpn",
      status: "In Progress",
      priority: "High",
      department: "Network",
    });
  });

  it("shows friendly empty states for a zero-count dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        dashboardResponse({
          summary: {
            myOpenTickets: 0,
            unassignedTickets: 0,
            inProgressTickets: 0,
            waitingForRequester: 0,
            requesterResolvedTickets: 0,
            incompleteActions: 0,
            overdueActions: 0,
          },
          myWork: [],
          unassigned: [],
          attention: [],
          recentActions: [],
          generatedAt: "2026-10-29T10:42:00.000Z",
        }),
      ),
    );

    render(<StaffDashboard onOpenTicket={vi.fn()} onOpenQueue={vi.fn()} />);

    expect(await screen.findByText(/No tickets assigned to you right now/)).toBeInTheDocument();
    expect(screen.getByText("Nothing needs attention right now.")).toBeInTheDocument();
    expect(screen.getByText("No unassigned tickets.")).toBeInTheDocument();
    expect(screen.getByText("No actions recorded in this period.")).toBeInTheDocument();
  });

  it("renders a safe forbidden panel without dashboard data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { success: false, error: { code: "FORBIDDEN", message: "No access." } },
          403,
        ),
      ),
    );

    render(<StaffDashboard onOpenTicket={vi.fn()} onOpenQueue={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/don't have access/i);
    expect(screen.queryByText("IT Staff Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /My open tickets/ })).not.toBeInTheDocument();
  });

  it("shows a safe failure banner and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message: "Boom" } }, 500),
      )
      .mockResolvedValueOnce(dashboardResponse(STAFF_DATA));
    vi.stubGlobal("fetch", fetchMock);

    render(<StaffDashboard onOpenTicket={vi.fn()} onOpenQueue={vi.fn()} />);

    expect(await screen.findByText(/Unable to load the dashboard right now/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "IT Staff Dashboard" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
