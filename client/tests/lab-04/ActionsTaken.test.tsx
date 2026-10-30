// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ActionsTaken from "../../src/ActionsTaken";
import type { ActionTakenItem } from "../../src/api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const STAFF_USER = { id: 7, name: "IT Staff One", role: "IT Staff" };
const REQUESTER_USER = { id: 3, name: "Alice Johnson", role: "Requester" };

const FOLLOW_UP_ACTION: ActionTakenItem = {
  id: 501,
  ticketId: 101,
  ticketNumber: "TT-0101",
  actionAt: "2026-10-29T09:00:00.000Z",
  description: "Checked the VPN client logs and reproduced the timeout.",
  result: "Confirmed an expired gateway certificate.",
  performedBy: { id: 7, name: "IT Staff One", role: "IT Staff" },
  followUpRequired: true,
  followUpNote: "Confirm with the requester after the certificate renewal.",
  attachmentNotes: "Log excerpt attached to the ticket.",
  version: 1,
  createdAt: "2026-10-29T09:05:00.000Z",
  updatedAt: "2026-10-29T09:05:00.000Z",
};

const PLAIN_ACTION: ActionTakenItem = {
  id: 502,
  ticketId: 101,
  ticketNumber: "TT-0101",
  actionAt: "2026-10-28T14:30:00.000Z",
  description: "Restarted the affected service.",
  result: "Authentication succeeded from a second client.",
  performedBy: { id: 11, name: "Admin User", role: "Administrator" },
  followUpRequired: false,
  followUpNote: "Optional note retained.",
  attachmentNotes: null,
  version: 1,
  createdAt: "2026-10-28T14:35:00.000Z",
  updatedAt: "2026-10-28T14:35:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function listResponse(items: ActionTakenItem[]) {
  return jsonResponse({
    success: true,
    data: {
      items,
      pagination: { page: 1, limit: 50, total: items.length, totalPages: 1 },
    },
  });
}

function mockActionsApi(options: {
  initial?: ActionTakenItem[];
  afterSave?: ActionTakenItem[];
  created?: ActionTakenItem;
  postDeferred?: boolean;
} = {}) {
  let getCount = 0;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<unknown> => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "GET" && url.includes("/actions")) {
        getCount += 1;
        return listResponse(getCount === 1 ? options.initial ?? [] : options.afterSave ?? options.initial ?? []);
      }

      if (method === "POST" && url === "/api/staff/tickets/101/actions") {
        const created = options.created ?? FOLLOW_UP_ACTION;
        if (options.postDeferred) {
          return new Promise((resolve) => {
            setTimeout(() => resolve(jsonResponse({ success: true, data: created }, 201)), 20);
          });
        }
        return jsonResponse({ success: true, data: created }, 201);
      }

      return jsonResponse(
        { success: false, error: { code: "NOT_FOUND", message: "Unexpected request." } },
        404,
      );
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, getCount: () => getCount };
}

describe("ActionsTaken (lab-04, Issue 3)", () => {
  it("renders the newest-first timeline with follow-up badges for IT Staff", async () => {
    mockActionsApi({ initial: [FOLLOW_UP_ACTION, PLAIN_ACTION] });

    render(<ActionsTaken ticketId={101} currentUser={STAFF_USER} />);

    expect(await screen.findByText(FOLLOW_UP_ACTION.description)).toBeInTheDocument();
    expect(screen.getByText(PLAIN_ACTION.description)).toBeInTheDocument();
    expect(screen.getByText("Follow-up required")).toBeInTheDocument();
    expect(screen.getByText("No follow-up")).toBeInTheDocument();
    expect(screen.getByText("Confirm with the requester after the certificate renewal.")).toBeInTheDocument();
    expect(screen.getByText("Optional note retained.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Action Taken" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Edit Action Taken/ })).toHaveLength(2);
  });

  it("renders the read-only timeline for a Requester and uses the requester endpoint", async () => {
    const { fetchMock } = mockActionsApi({ initial: [FOLLOW_UP_ACTION] });

    render(<ActionsTaken ticketId={101} currentUser={REQUESTER_USER} />);

    expect(await screen.findByText(FOLLOW_UP_ACTION.description)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tickets/101/actions?limit=50&sort=newest",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("hides Add Action Taken and edit controls from Requesters", async () => {
    mockActionsApi({ initial: [FOLLOW_UP_ACTION, PLAIN_ACTION] });

    render(<ActionsTaken ticketId={101} currentUser={REQUESTER_USER} />);

    expect(await screen.findByText(FOLLOW_UP_ACTION.description)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Action Taken" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit Action Taken/ })).not.toBeInTheDocument();
  });

  it("shows the required error for an empty or whitespace-only Follow-up Note", async () => {
    const { fetchMock } = mockActionsApi({ initial: [] });
    render(<ActionsTaken ticketId={101} currentUser={STAFF_USER} />);

    await screen.findByText("No Actions Taken yet.");
    await userEvent.click(screen.getByRole("button", { name: "Add Action Taken" }));

    await userEvent.type(screen.getByLabelText(/Action Description/), "Investigated the issue.");
    await userEvent.type(screen.getByLabelText(/^Result/), "Found the root cause.");
    await userEvent.click(screen.getByLabelText("Follow-up required?"));

    const followUpNote = screen.getByLabelText(/Follow-up Note/);
    await userEvent.type(followUpNote, "   ");
    fireEvent.blur(followUpNote);

    expect(
      screen.getByText("Follow-up note is required when follow-up is required."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    expect(
      screen.getByText("Follow-up note is required when follow-up is required."),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => (init?.method ?? "GET").toUpperCase() === "POST"),
    ).toBe(false);
  });

  it("submits a valid action and refreshes the timeline", async () => {
    const created: ActionTakenItem = {
      ...FOLLOW_UP_ACTION,
      id: 777,
      description: "Installed the renewed certificate.",
      result: "VPN authentication works again.",
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
      version: 1,
    };
    const { fetchMock, getCount } = mockActionsApi({
      initial: [],
      afterSave: [created],
      created,
    });

    render(<ActionsTaken ticketId={101} currentUser={STAFF_USER} />);
    await screen.findByText("No Actions Taken yet.");
    await userEvent.click(screen.getByRole("button", { name: "Add Action Taken" }));

    await userEvent.type(screen.getByLabelText(/Action Description/), created.description);
    await userEvent.type(screen.getByLabelText(/^Result/), created.result);
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    expect(await screen.findByText("Action Taken added.")).toBeInTheDocument();
    expect(await screen.findByText(created.description)).toBeInTheDocument();
    expect(getCount()).toBe(2);

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init?.method ?? "GET").toUpperCase() === "POST",
    );
    expect(postCall).toBeTruthy();
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      description: created.description,
      result: created.result,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    });
  });

  it("prevents double submission when the save button is clicked repeatedly", async () => {
    const created: ActionTakenItem = {
      ...PLAIN_ACTION,
      id: 888,
      description: "Double-click guard action.",
      result: "Only one row should be created.",
    };
    const { fetchMock } = mockActionsApi({
      initial: [],
      afterSave: [created],
      created,
      postDeferred: true,
    });

    render(<ActionsTaken ticketId={101} currentUser={STAFF_USER} />);
    await screen.findByText("No Actions Taken yet.");
    await userEvent.click(screen.getByRole("button", { name: "Add Action Taken" }));

    await userEvent.type(screen.getByLabelText(/Action Description/), created.description);
    await userEvent.type(screen.getByLabelText(/^Result/), created.result);

    const form = screen.getByRole("button", { name: "Save Action" }).closest("form")!;
    const saveButton = within(form).getByRole("button", { name: "Save Action" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(
          ([, init]) => (init?.method ?? "GET").toUpperCase() === "POST",
        ),
      ).toHaveLength(1);
    });
    expect(await screen.findByText("Action Taken added.")).toBeInTheDocument();
  });
});
