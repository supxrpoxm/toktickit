// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import StaffTicketQueue from "../../src/StaffTicketQueue";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const queueItems = [
  {
    id: 101,
    ticketNumber: "TT-0101",
    title: "Cannot login to VPN",
    category: "Network",
    requestedPriority: "High",
    itPriority: "Medium",
    status: "Open",
    owner: { id: 7, name: "IT Staff One" },
    requester: { id: 3, name: "Alice Johnson" },
    createdAt: "2026-09-04T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
  },
  {
    id: 102,
    ticketNumber: "TT-0102",
    title: "Request new laptop",
    category: "Hardware",
    requestedPriority: "Medium",
    itPriority: "Medium",
    status: "In Progress",
    owner: null,
    requester: { id: 4, name: "Brandon Lee" },
    createdAt: "2026-09-03T10:00:00.000Z",
    updatedAt: "2026-09-04T10:00:00.000Z",
  },
];

const pagination = { page: 1, limit: 10, total: 2, totalPages: 1 };

function mockQueueApi(options: {
  items?: typeof queueItems;
  total?: number;
  totalPages?: number;
  status?: number;
  body?: unknown;
  onRequest?: (url: string) => void;
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    options.onRequest?.(url);

    if (url.includes("/api/categories")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [{ id: 4, name: "Network" }],
      });
    }

    if (url.includes("/api/staff/tickets")) {
      const status = options.status ?? 200;
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () =>
          options.body ?? {
            success: true,
            data: {
              items: options.items ?? queueItems,
              pagination: {
                page: 1,
                limit: 10,
                total: options.total ?? 2,
                totalPages: options.totalPages ?? 1,
              },
            },
          },
      });
    }

    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderQueue(onOpenTicket: (id: number) => void = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={["/staff/queue"]}>
      <StaffTicketQueue onOpenTicket={onOpenTicket} />
    </MemoryRouter>,
  );
}

describe("StaffTicketQueue (lab-03)", () => {
  it("shows a loading state while the queue is being fetched", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    renderQueue();

    expect(screen.getByText("Loading ticket queue...")).toBeInTheDocument();
  });

  it("renders ticket rows with all queue fields and an Open action", async () => {
    const onOpenTicket = vi.fn();
    mockQueueApi();
    const { container } = renderQueue(onOpenTicket);

    expect(await screen.findAllByText("TT-0101")).toHaveLength(2); // table + card
    const table = container.querySelector(".staff-queue-table") as HTMLElement;
    expect(within(table).getByText("Cannot login to VPN")).toBeInTheDocument();
    expect(within(table).getByText("IT Staff One")).toBeInTheDocument();
    expect(within(table).getByText("Unassigned")).toBeInTheDocument();
    // Diverged priorities render side-by-side pills.
    expect(within(table).getByText("Req: High")).toBeInTheDocument();
    expect(within(table).getByText("IT: Medium")).toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 2 tickets")).toBeInTheDocument();

    const openButtons = within(table).getAllByRole("button", { name: /Open ticket TT-0101/ });
    await userEvent.click(openButtons[0]);
    expect(onOpenTicket).toHaveBeenCalledWith(101);
  });

  it("sends search text to the API and keeps it in the URL", async () => {
    const seen: string[] = [];
    mockQueueApi({ items: [], total: 0, onRequest: (url) => seen.push(url) });
    renderQueue();

    expect(await screen.findByText("No tickets in the queue")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search tickets"), "vpn");

    await waitFor(() => {
      expect(seen.some((url) => url.includes("search=vpn"))).toBe(true);
    });
  });

  it("sends status and ownership filters to the API", async () => {
    const seen: string[] = [];
    mockQueueApi({ onRequest: (url) => seen.push(url) });
    renderQueue();

    expect(await screen.findAllByText("TT-0101")).toHaveLength(2);
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "Open");
    await userEvent.selectOptions(screen.getByLabelText("Filter by ownership"), "unassigned");

    await waitFor(() => {
      expect(seen.some((url) => url.includes("status=Open"))).toBe(true);
      expect(seen.some((url) => url.includes("owner=unassigned"))).toBe(true);
    });
  });

  it("paginates through the queue", async () => {
    const seen: string[] = [];
    mockQueueApi({ total: 25, totalPages: 3, onRequest: (url) => seen.push(url) });
    renderQueue();

    expect(await screen.findAllByText("TT-0101")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(seen.some((url) => url.includes("page=2"))).toBe(true);
    });
  });

  it("shows the empty state when the queue has no tickets", async () => {
    mockQueueApi({ items: [], total: 0 });
    renderQueue();

    expect(await screen.findByText("No tickets in the queue")).toBeInTheDocument();
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("shows no-results with a working Clear filters action", async () => {
    mockQueueApi({ items: [], total: 0 });
    renderQueue();

    await userEvent.type(await screen.findByLabelText("Search tickets"), "zzz");
    expect(await screen.findByText("No matching tickets")).toBeInTheDocument();

    // Both the toolbar and the no-results panel offer "Clear filters".
    const clearButtons = screen.getAllByRole("button", { name: "Clear filters" });
    expect(clearButtons.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(clearButtons[clearButtons.length - 1]);
    expect(screen.getByLabelText("Search tickets")).toHaveValue("");
  });

  it("shows the forbidden state for unauthorized roles without ticket data", async () => {
    mockQueueApi({
      status: 403,
      body: { success: false, error: { code: "FORBIDDEN", message: "You don't have access." } },
    });
    renderQueue();

    expect(await screen.findByText(/You don't have access to the ticket queue/)).toBeInTheDocument();
    expect(screen.queryByText("TT-0101")).not.toBeInTheDocument();
  });

  it("shows a failure state with retry that preserves filters", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/categories")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => [] });
        }
        calls++;
        // Fail the mount fetch plus one fetch per typed character ("vpn"),
        // so the failure banner is showing before the retry succeeds.
        if (calls <= 4) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ success: false, error: { code: "INTERNAL_ERROR" } }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { items: queueItems, pagination } }),
        });
      }),
    );
    renderQueue();

    await userEvent.type(await screen.findByLabelText("Search tickets"), "vpn");
    expect(await screen.findByText("Unable to load the ticket queue right now.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByText("TT-0101")).toHaveLength(2);
    expect(screen.getByLabelText("Search tickets")).toHaveValue("vpn");
  });

  it("renders responsive cards with the same data as the table", async () => {
    mockQueueApi();
    const { container } = renderQueue();

    expect(await screen.findAllByText("TT-0101")).toHaveLength(2);

    const cards = container.querySelector(".staff-queue-cards");
    const table = container.querySelector(".staff-queue-table");
    expect(cards).toBeTruthy();
    expect(table).toBeTruthy();
    // Cards carry the responsive visibility classes (table only on md+).
    expect(cards?.className).toContain("d-md-none");
    expect(table?.className).toContain("d-none");
    expect(within(cards as HTMLElement).getByText("Cannot login to VPN")).toBeInTheDocument();
    expect(within(cards as HTMLElement).getByRole("button", { name: /Open ticket TT-0102/ })).toBeInTheDocument();
  });
});
