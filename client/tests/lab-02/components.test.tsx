// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CreateTicketForm from "../../src/CreateTicketForm";
import MyTickets from "../../src/MyTickets";
import TicketDetail from "../../src/TicketDetail";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MyTickets", () => {
  it("shows a loading spinner while tickets are being fetched", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(<MyTickets requesterId={1} onViewDetail={vi.fn()} />);

    expect(screen.getByText("Loading tickets...")).toBeTruthy();
  });

  it("renders fetched tickets and calls onViewDetail when a row is clicked", async () => {
    const onViewDetail = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tickets: [{ id: 101, createdAt: "2026-09-04", title: "VPN access", status: "Open", priority: "High", category: { id: 1, name: "Network" } }],
        pagination: { totalPages: 1 },
      }),
    }));

    render(<MyTickets requesterId={1} onViewDetail={onViewDetail} />);

    expect(await screen.findByText("VPN access")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /VPN access/i }));

    expect(onViewDetail).toHaveBeenCalledWith(101);
  });

  it("shows an error message when the API fails to load tickets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    }));

    render(<MyTickets requesterId={1} onViewDetail={vi.fn()} />);

    expect(await screen.findByText("Unable to load tickets right now.")).toBeTruthy();
  });

  it("shows empty state when the requester has no tickets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tickets: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      }),
    }));

    render(<MyTickets requesterId={1} onViewDetail={vi.fn()} />);

    expect(await screen.findByText("No tickets yet")).toBeTruthy();
    expect(screen.getByText(/You do not have any tickets yet/)).toBeTruthy();
  });

  it("offers sort options for ticket number and priority", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tickets: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      }),
    }));

    render(<MyTickets requesterId={1} onViewDetail={vi.fn()} />);

    expect(await screen.findByText("No tickets yet")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Sort by Ticket No" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Sort by Priority" })).toBeTruthy();
  });
});

describe("TicketDetail", () => {
  it("shows loading state before the detail response resolves", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(<TicketDetail ticketId={101} requesterId={1} onBack={vi.fn()} />);

    expect(screen.getByText("Loading ticket details...")).toBeTruthy();
  });

  it("renders ticket metadata and distinguishes deleted attachments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 101,
        title: "VPN access",
        description: "Remote access is required.",
        status: "Open",
        createdAt: "2026-09-04T10:00:00.000Z",
        attachments: [
          { id: 1, fileName: "guide.pdf", mimeType: "application/pdf", sizeBytes: 1024 },
          { id: 2, fileName: "old.png", mimeType: "image/png", sizeBytes: 2048, deletedAt: "2026-09-04T11:00:00.000Z" },
        ],
      }),
    }));

    render(<TicketDetail ticketId={101} requesterId={1} onBack={vi.fn()} />);

    expect(await screen.findByText("guide.pdf")).toBeTruthy();
    expect(screen.getByText("application/pdf · 1 KB")).toBeTruthy();
    expect(screen.getByText("old.png")).toBeTruthy();
    expect(screen.getByText("Deleted")).toBeTruthy();
    expect(screen.getByRole("button", { name: /download/i })).toBeTruthy();
  });

  it("shows an error state when the API fails to load the ticket", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    }));

    render(<TicketDetail ticketId={101} requesterId={1} onBack={vi.fn()} />);

    expect(await screen.findByText(/Unable to load this ticket right now/)).toBeTruthy();
  });

  it("shows not-found state when the ticket does not exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    }));

    render(<TicketDetail ticketId={999} requesterId={1} onBack={vi.fn()} />);

    expect(await screen.findByText("Ticket Not Found")).toBeTruthy();
    expect(screen.getByText(/does not exist or is not available/)).toBeTruthy();
  });

  it("shows not-found state when access is forbidden", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    }));

    render(<TicketDetail ticketId={101} requesterId={1} onBack={vi.fn()} />);

    expect(await screen.findByText("Ticket Not Found")).toBeTruthy();
  });

  it("shows empty attachment state when ticket has no attachments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 101,
        title: "VPN access",
        description: "Remote access is required.",
        status: "Open",
        createdAt: "2026-09-04T10:00:00.000Z",
        attachments: [],
      }),
    }));

    render(<TicketDetail ticketId={101} requesterId={1} onBack={vi.fn()} />);

    expect(await screen.findByText("No attachments for this ticket.")).toBeTruthy();
  });
});

describe("CreateTicketForm", () => {
  it("shows validation feedback and does not submit incomplete input", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<CreateTicketForm />);
    fireEvent.submit(screen.getByRole("button", { name: "Submit Ticket" }).closest("form")!);

    expect(screen.getByText("Please complete all required fields.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits valid ticket data and enters a busy state", async () => {
    const fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    render(<CreateTicketForm />);
    const form = screen.getByRole("button", { name: "Submit Ticket" }).closest("form")!;
    const selects = form.querySelectorAll("select");
    const textInputs = form.querySelectorAll('input[type="text"]');
    const description = form.querySelector("textarea")!;

    fireEvent.change(selects[0], { target: { value: "2" } });
    fireEvent.change(textInputs[2], { target: { value: "VPN access" } });
    fireEvent.change(description, { target: { value: "Remote access is required." } });
    fireEvent.submit(form);

    expect(screen.getByRole("button", { name: "Submitting..." })).toHaveProperty("disabled", true);
    expect(fetchMock).toHaveBeenCalledWith("/api/tickets", expect.objectContaining({ method: "POST" }));
  });

  it("shows an error message when the API fails during ticket creation", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    render(<CreateTicketForm />);
    const form = screen.getByRole("button", { name: "Submit Ticket" }).closest("form")!;
    const selects = form.querySelectorAll("select");
    const textInputs = form.querySelectorAll('input[type="text"]');
    const description = form.querySelector("textarea")!;

    fireEvent.change(selects[0], { target: { value: "2" } });
    fireEvent.change(textInputs[2], { target: { value: "VPN access" } });
    fireEvent.change(description, { target: { value: "Remote access is required." } });
    fireEvent.submit(form);

    expect(await screen.findByText("Unable to create ticket right now. Please try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit Ticket" })).not.toHaveProperty("disabled", true);
  });
});