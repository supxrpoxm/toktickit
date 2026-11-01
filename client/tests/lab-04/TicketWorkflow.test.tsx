// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import TicketWorkflow from "../../src/TicketWorkflow";
import { UserRole } from "../../src/roles";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const STAFF_USER = { id: 7, name: "IT Staff One", role: UserRole.IT_STAFF };
const ADMIN_USER = { id: 11, name: "Admin User", role: UserRole.ADMINISTRATOR };
const REQUESTER_USER = { id: 3, name: "Alice Johnson", role: UserRole.REQUESTER };

const UPDATED_AT = "2026-10-30T10:00:00.000Z";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("TicketWorkflow (lab-04, Issue 4)", () => {
  it("shows only the permitted next transitions for IT Staff", () => {
    render(
      <TicketWorkflow
        ticketId={101}
        status="Open"
        updatedAt={UPDATED_AT}
        currentUser={STAFF_USER}
      />,
    );

    const group = screen.getByRole("group", { name: "Permitted status transitions" });
    expect(within(group).getByRole("button", { name: "In Progress" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Waiting for Requester" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Cancelled" })).toBeInTheDocument();

    expect(within(group).queryByRole("button", { name: "Resolved" })).not.toBeInTheDocument();
    expect(within(group).queryByRole("button", { name: "Closed" })).not.toBeInTheDocument();
    expect(within(group).queryByRole("button", { name: "New" })).not.toBeInTheDocument();
    expect(within(group).queryByRole("button", { name: "Reopened" })).not.toBeInTheDocument();
  });

  it("shows no formal transitions for terminal statuses", () => {
    render(
      <TicketWorkflow
        ticketId={101}
        status="Closed"
        updatedAt={UPDATED_AT}
        currentUser={ADMIN_USER}
      />,
    );

    expect(screen.queryByRole("group", { name: "Permitted status transitions" })).not.toBeInTheDocument();
    expect(screen.getByText(/terminal state \(Closed\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reopened" })).not.toBeInTheDocument();
  });

  it("gives requesters only advisory controls and never sends a status change", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: {
          id: 101,
          status: "In Progress",
          requesterResolved: true,
          requesterResolvedAt: "2026-10-30T10:05:00.000Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TicketWorkflow
        ticketId={101}
        status="In Progress"
        updatedAt={UPDATED_AT}
        currentUser={REQUESTER_USER}
      />,
    );

    expect(screen.queryByRole("group", { name: "Permitted status transitions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolved" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "In Progress" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Advisory note (optional)"), "The VPN works again.");
    await userEvent.click(screen.getByRole("button", { name: "Indicate Issue is Resolved" }));

    expect(await screen.findByText(/IT staff have been notified/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tickets/101/resolved-signal");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ note: "The VPN works again." });
  });

  it("sends updatedAt with a transition and handles a 409 conflict", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          success: false,
          error: {
            code: "STALE_UPDATE",
            message: "This ticket was updated by someone else.",
            currentStatus: "Waiting for Requester",
            currentUpdatedAt: "2026-10-30T10:10:00.000Z",
          },
        },
        409,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TicketWorkflow
        ticketId={101}
        status="Open"
        updatedAt={UPDATED_AT}
        currentUser={STAFF_USER}
        onRefreshRequested={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "In Progress" }));

    expect(await screen.findByText("This ticket was updated by someone else.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh latest ticket" })).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      status: "In Progress",
      updatedAt: UPDATED_AT,
    });
  });

  it("prevents duplicate transition requests while one is pending", async () => {
    let resolvePatch: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePatch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TicketWorkflow
        ticketId={101}
        status="Open"
        updatedAt={UPDATED_AT}
        currentUser={STAFF_USER}
      />,
    );

    const button = screen.getByRole("button", { name: "In Progress" });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    resolvePatch?.(
      jsonResponse({
        success: true,
        data: { id: 101, status: "In Progress", updatedAt: "2026-10-30T10:05:00.000Z" },
      }),
    );
    expect(await screen.findByText("Status changed to In Progress.")).toBeInTheDocument();
  });
});
