// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import StaffTicketDetail from "../../src/StaffTicketDetail";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const DETAIL = {
  id: 101,
  ticketNumber: "TT-0101",
  title: "Cannot login to VPN",
  description: "Remote access required for the team.",
  status: "Open",
  requestedPriority: "High",
  itPriority: "High",
  owner: null as { id: number; name: string } | null,
  requester: { id: 3, name: "Alice Johnson" },
  category: { id: 4, name: "Network" },
  relatedSystem: { id: 3, name: "VPN" },
  attachments: [
    { id: 501, fileName: "evidence.png", mimeType: "image/png", sizeBytes: 12345, createdAt: "2026-09-04T10:00:00.000Z" },
  ],
  requesterResolved: false,
  requesterResolvedAt: null,
  commentsCount: 1,
  notesCount: 1,
  createdAt: "2026-09-04T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
};

const COMMENTS = [
  {
    id: 12,
    ticketId: 101,
    author: { id: 3, name: "Alice Johnson", role: "Requester" },
    body: "Still failing after restart.",
    createdAt: "2026-09-06T10:00:00.000Z",
  },
];

const NOTES = [
  {
    id: 31,
    ticketId: 101,
    author: { id: 7, name: "IT Staff One", role: "IT Staff" },
    body: "Checking VPN logs for this user.",
    createdAt: "2026-09-06T11:00:00.000Z",
  },
];

const USERS = [
  { id: 7, name: "IT Staff One", role: "IT Staff" },
  { id: 8, name: "IT Staff Two", role: "IT Staff" },
];

type MockConfig = {
  detail?: unknown;
  detailStatus?: number;
  comments?: unknown[];
  notes?: unknown[];
  threadsStatus?: number;
  patchOwner?: (body: Record<string, unknown>) => { status: number; body: unknown };
  patchPriority?: (body: Record<string, unknown>) => { status: number; body: unknown };
  patchStatus?: (body: Record<string, unknown>) => { status: number; body: unknown };
  postComment?: (body: Record<string, unknown>) => { status: number; body: unknown };
  postNote?: (body: Record<string, unknown>) => { status: number; body: unknown };
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

    if (url === "/api/staff/tickets/101" && method === "GET") {
      const status = config.detailStatus ?? 200;
      if (status !== 200) {
        return ok(
          { success: false, error: { code: status === 403 ? "FORBIDDEN" : "NOT_FOUND", message: "Denied." } },
          status,
        );
      }
      return ok({ success: true, data: config.detail ?? DETAIL });
    }
    if (url.startsWith("/api/staff/tickets/101/comments")) {
      if (method === "GET") {
        const status = config.threadsStatus ?? 200;
        if (status !== 200) return ok({ success: false, error: { code: "INTERNAL_ERROR" } }, status);
        return ok({
          success: true,
          data: { items: config.comments ?? COMMENTS, pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } },
        });
      }
      const handler = config.postComment;
      if (handler) {
        const result = handler(payload);
        return ok(result.body, result.status);
      }
      return ok(
        {
          success: true,
          data: {
            id: 13,
            ticketId: 101,
            author: { id: 7, name: "IT Staff One", role: "IT Staff" },
            body: String(payload.body ?? ""),
            createdAt: "2026-09-07T10:00:00.000Z",
          },
        },
        201,
      );
    }
    if (url.startsWith("/api/staff/tickets/101/notes")) {
      if (method === "GET") {
        const status = config.threadsStatus ?? 200;
        if (status !== 200) return ok({ success: false, error: { code: "INTERNAL_ERROR" } }, status);
        return ok({
          success: true,
          data: { items: config.notes ?? NOTES, pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } },
        });
      }
      const handler = config.postNote;
      if (handler) {
        const result = handler(payload);
        return ok(result.body, result.status);
      }
      return ok(
        {
          success: true,
          data: {
            id: 32,
            ticketId: 101,
            author: { id: 7, name: "IT Staff One", role: "IT Staff" },
            body: String(payload.body ?? ""),
            createdAt: "2026-09-07T11:00:00.000Z",
          },
        },
        201,
      );
    }
    if (url === "/api/staff/users" && method === "GET") {
      return ok({ success: true, data: { items: USERS } });
    }
    if (url === "/api/staff/tickets/101/owner" && method === "PATCH") {
      if (config.patchOwner) {
        const result = config.patchOwner(payload);
        return ok(result.body, result.status);
      }
      if ("claim" in payload) return ok({ success: true, data: { id: 101, owner: USERS[0] } });
      if (payload.ownerId === null) return ok({ success: true, data: { id: 101, owner: null } });
      const user = USERS.find((u) => u.id === payload.ownerId) ?? null;
      return ok({ success: true, data: { id: 101, owner: user } });
    }
    if (url === "/api/staff/tickets/101/priority" && method === "PATCH") {
      if (config.patchPriority) {
        const result = config.patchPriority(payload);
        return ok(result.body, result.status);
      }
      return ok({ success: true, data: { id: 101, requestedPriority: "High", itPriority: payload.itPriority } });
    }
    if (url === "/api/staff/tickets/101/status" && method === "PATCH") {
      if (config.patchStatus) {
        const result = config.patchStatus(payload);
        return ok(result.body, result.status);
      }
      return ok({ success: true, data: { id: 101, status: payload.status, updatedAt: "2026-09-07T10:00:00.000Z" } });
    }
    return ok({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDetail(config: MockConfig = {}) {
  mockApi(config);
  return render(<StaffTicketDetail ticketId={101} onBack={vi.fn()} />);
}

describe("StaffTicketDetail (lab-03, Issue 4)", () => {
  it("shows a loading state while the ticket is being fetched", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<StaffTicketDetail ticketId={101} onBack={vi.fn()} />);

    expect(screen.getByText("Loading ticket details...")).toBeInTheDocument();
  });

  it("groups read-only context with editable owner, priority, and status controls", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Cannot login to VPN" })).toBeInTheDocument();
    expect(screen.getByText("Ticket TT-0101")).toBeInTheDocument();
    expect(screen.getByText("Remote access required for the team.")).toBeInTheDocument();
    // Requester appears in the read-only context and as a thread author.
    expect(screen.getAllByText("Alice Johnson").length).toBeGreaterThanOrEqual(1);

    // Editable operational controls.
    expect(screen.getByLabelText("Ticket owner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim this ticket" })).toBeInTheDocument();
    expect(screen.getByLabelText("IT Priority")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save priority" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save status" })).toBeInTheDocument();

    // Attachments continuity from Lab 2.
    expect(screen.getByText("evidence.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download/ })).toBeInTheDocument();
  });

  it("claims an unassigned ticket and shows a success toast", async () => {
    const seen: string[] = [];
    renderDetail({ seen });

    await userEvent.click(await screen.findByRole("button", { name: "Claim this ticket" }));

    await waitFor(() => {
      expect(seen).toContain("PATCH /api/staff/tickets/101/owner");
    });
    expect(await screen.findByText("Ticket claimed. You are now the owner.")).toBeInTheDocument();
    // The owner control now reflects the claiming staff member.
    expect(screen.getByLabelText("Ticket owner")).toHaveValue("7");
  });

  it("saves a reassigned owner from the staff select", async () => {
    const seen: string[] = [];
    renderDetail({ seen, detail: { ...DETAIL, owner: { id: 7, name: "IT Staff One" } } });

    expect(await screen.findByRole("heading", { name: "Cannot login to VPN" })).toBeInTheDocument();
    // Assigned tickets offer reassignment, not claiming.
    expect(screen.queryByRole("button", { name: "Claim this ticket" })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Ticket owner"), "8");
    await userEvent.click(screen.getByRole("button", { name: "Save owner" }));

    expect(await screen.findByText("Owner updated to IT Staff Two.")).toBeInTheDocument();
  });

  it("saves IT Priority without touching Requested Priority", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Cannot login to VPN" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "Low");
    await userEvent.click(screen.getByRole("button", { name: "Save priority" }));

    expect(await screen.findByText("IT Priority set to Low.")).toBeInTheDocument();
  });

  it("saves a non-destructive status change immediately", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Cannot login to VPN" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "In Progress");
    await userEvent.click(screen.getByRole("button", { name: "Save status" }));

    expect(await screen.findByText("Status changed to In Progress.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms destructive status changes with consequence text", async () => {
    const seen: string[] = [];
    mockApi({ seen });
    render(<StaffTicketDetail ticketId={101} onBack={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Cannot login to VPN" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "Cancelled");
    await userEvent.click(screen.getByRole("button", { name: "Save status" }));

    // No request yet — the modal gates it.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Change status to Cancelled?");
    expect(dialog).toHaveTextContent("without a resolution");
    expect(seen).not.toContain("PATCH /api/staff/tickets/101/status");

    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm change" }));
    await waitFor(() => {
      expect(seen).toContain("PATCH /api/staff/tickets/101/status");
    });
    expect(await screen.findByText("Status changed to Cancelled.")).toBeInTheDocument();
  });

  it("cancelling the confirmation sends nothing", async () => {
    const seen: string[] = [];
    mockApi({ seen });
    render(<StaffTicketDetail ticketId={101} onBack={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Cannot login to VPN" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "Closed");
    await userEvent.click(screen.getByRole("button", { name: "Save status" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(seen).not.toContain("PATCH /api/staff/tickets/101/status");
  });

  it("shows illegal transitions inline with the allowed list", async () => {
    renderDetail({
      patchStatus: () => ({
        status: 422,
        body: {
          success: false,
          error: {
            code: "INVALID_TRANSITION",
            message: "Cannot move from Open to Closed. Allowed: In Progress, Waiting for Requester, Cancelled.",
            fields: { status: "Allowed transitions from Open: In Progress, Waiting for Requester, Cancelled." },
          },
        },
      }),
    });

    expect(await screen.findByRole("heading", { name: "Cannot login to VPN" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "Closed");
    await userEvent.click(screen.getByRole("button", { name: "Save status" }));
    // Confirm the destructive target first, then the API rejects it.
    await userEvent.click(await screen.findByRole("button", { name: "Confirm change" }));

    expect(await screen.findByText(/Allowed: In Progress, Waiting for Requester, Cancelled/)).toBeInTheDocument();
  });

  it("keeps public comments and internal notes visually distinct", async () => {
    const { container } = renderDetail();

    expect(await screen.findByRole("heading", { name: /Public comments/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Internal notes/ })).toBeInTheDocument();

    // Separate cards with separate affordances.
    const publicCard = container.querySelector(".thread-public") as HTMLElement;
    const internalCard = container.querySelector(".thread-internal") as HTMLElement;
    expect(publicCard).toBeTruthy();
    expect(internalCard).toBeTruthy();
    expect(within(publicCard).getByText("Still failing after restart.")).toBeInTheDocument();
    expect(within(internalCard).getByText("Checking VPN logs for this user.")).toBeInTheDocument();
    // Private content must not leak into the public card.
    expect(within(publicCard).queryByText("Checking VPN logs for this user.")).not.toBeInTheDocument();

    // The internal card carries a persistent slate header stripe + lock affordance.
    const stripe = internalCard.querySelector("div") as HTMLElement;
    expect(stripe.style.backgroundColor).toBe("rgb(51, 65, 85)");
    expect(screen.getByText("Only staff see this")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post public reply" })).toBeInTheDocument();
    const noteButton = screen.getByRole("button", { name: /Add internal note/ });
    expect(noteButton).toBeInTheDocument();
    expect(noteButton).not.toHaveClass("btn-outline-success");
  });

  it("posts to each thread independently and appends entries", async () => {
    renderDetail();

    expect(await screen.findByText("Still failing after restart.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Reply publicly"), "On my way to help.");
    await userEvent.click(screen.getByRole("button", { name: "Post public reply" }));
    expect(await screen.findByText("On my way to help.")).toBeInTheDocument();
    expect(await screen.findByText("Public reply posted.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Add a private note/), "Escalate if VPN logs are clean.");
    await userEvent.click(screen.getByRole("button", { name: /Add internal note/ }));
    expect(await screen.findByText("Escalate if VPN logs are clean.")).toBeInTheDocument();
    expect(await screen.findByText("Internal note added.")).toBeInTheDocument();
  });

  it("shows empty placeholders when threads have no entries", async () => {
    renderDetail({ comments: [], notes: [] });

    expect(await screen.findByText("No public comments yet.")).toBeInTheDocument();
    expect(await screen.findByText("No internal notes yet.")).toBeInTheDocument();
  });

  it("renders message bodies as plain text, never as HTML", async () => {
    renderDetail({ comments: [{ ...COMMENTS[0], body: "<script>alert(1)</script>" }] });

    expect(await screen.findByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();
  });

  it("shows the requester-resolved chip when the flag is set", async () => {
    renderDetail({ detail: { ...DETAIL, requesterResolved: true } });

    expect(await screen.findByText("Requester says resolved")).toBeInTheDocument();
  });

  it("shows the forbidden state without ticket data", async () => {
    renderDetail({ detailStatus: 403 });

    expect(await screen.findByText("You don't have access to this ticket.")).toBeInTheDocument();
    expect(screen.queryByText("Cannot login to VPN")).not.toBeInTheDocument();
  });

  it("shows a failure state with retry", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls++;
        if (url === "/api/staff/tickets/101" && calls === 1) {
          return ok({ success: false, error: { code: "INTERNAL_ERROR" } }, 500);
        }
        if (url === "/api/staff/tickets/101") return ok({ success: true, data: DETAIL });
        if (url.startsWith("/api/staff/tickets/101/comments")) {
          return ok({ success: true, data: { items: COMMENTS, pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } } });
        }
        if (url.startsWith("/api/staff/tickets/101/notes")) {
          return ok({ success: true, data: { items: NOTES, pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } } });
        }
        if (url === "/api/staff/users") return ok({ success: true, data: { items: USERS } });
        return ok({});
      }),
    );
    render(<StaffTicketDetail ticketId={101} onBack={vi.fn()} />);

    expect(await screen.findByText("Unable to load this ticket right now.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Cannot login to VPN" })).toBeInTheDocument();
  });
});
