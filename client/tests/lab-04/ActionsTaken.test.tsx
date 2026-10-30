// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ActionsTaken from "../../src/ActionsTaken";
import type { ActionTakenItem } from "../../src/api";
import { UserRole, formatRoleDisplay, isStaffRole } from "../../src/roles";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const STAFF_USER = { id: 7, name: "IT Staff One", role: UserRole.IT_STAFF };
const REQUESTER_USER = { id: 3, name: "Alice Johnson", role: UserRole.REQUESTER };

const FOLLOW_UP_ACTION: ActionTakenItem = {
  id: 501,
  ticketId: 101,
  ticketNumber: "TT-0101",
  actionAt: "2026-10-29T09:00:00.000Z",
  description: "Checked the VPN client logs and reproduced the timeout.",
  result: "Confirmed an expired gateway certificate.",
  performedBy: { id: 7, name: "IT Staff One", role: UserRole.IT_STAFF },
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
  performedBy: { id: 11, name: "Admin User", role: UserRole.ADMINISTRATOR },
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

type MockResult = { status: number; body: unknown };

function mockActionsApi(options: {
  initial?: ActionTakenItem[];
  afterSave?: ActionTakenItem[];
  created?: ActionTakenItem;
  postDeferred?: boolean;
  postResult?: MockResult;
  patchResult?: MockResult;
  refreshFailures?: number;
} = {}) {
  let getCount = 0;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<unknown> => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "GET" && url.includes("/actions")) {
        getCount += 1;
        if (getCount === 1) return listResponse(options.initial ?? []);

        const refreshNumber = getCount - 1;
        if (options.refreshFailures && refreshNumber <= options.refreshFailures) {
          return jsonResponse(
            {
              success: false,
              error: { code: "INTERNAL_ERROR", message: "The timeline could not refresh." },
            },
            500,
          );
        }
        return listResponse(options.afterSave ?? options.initial ?? []);
      }

      if (method === "POST" && url === "/api/staff/tickets/101/actions") {
        if (options.postResult) {
          return jsonResponse(options.postResult.body, options.postResult.status);
        }
        const created = options.created ?? FOLLOW_UP_ACTION;
        if (options.postDeferred) {
          return new Promise((resolve) => {
            setTimeout(() => resolve(jsonResponse({ success: true, data: created }, 201)), 20);
          });
        }
        return jsonResponse({ success: true, data: created }, 201);
      }

      if (method === "PATCH" && url === "/api/staff/tickets/101/actions/501") {
        if (options.patchResult) {
          return jsonResponse(options.patchResult.body, options.patchResult.status);
        }
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

  it("uses centralized role constants for permission checks and display labels", async () => {
    expect(formatRoleDisplay(UserRole.IT_STAFF)).toBe("IT Staff");
    expect(formatRoleDisplay("it_staff")).toBe("IT Staff");
    expect(formatRoleDisplay(UserRole.ADMINISTRATOR)).toBe("Administrator");
    expect(isStaffRole(UserRole.IT_STAFF)).toBe(true);
    expect(isStaffRole(UserRole.ADMINISTRATOR)).toBe(true);
    expect(isStaffRole(UserRole.REQUESTER)).toBe(false);

    mockActionsApi({ initial: [FOLLOW_UP_ACTION] });
    render(<ActionsTaken ticketId={101} currentUser={STAFF_USER} />);

    expect(await screen.findByRole("button", { name: "Add Action Taken" })).toBeInTheDocument();
    expect(screen.getByText("IT Staff")).toBeInTheDocument();
  });

  it("keeps the draft and offers reload when the server reports a stale update", async () => {
    const latest: ActionTakenItem = {
      ...FOLLOW_UP_ACTION,
      version: 2,
      description: "Server latest description.",
      result: "Server latest result.",
      updatedAt: "2026-10-30T10:00:00.000Z",
    };
    const { fetchMock } = mockActionsApi({
      initial: [FOLLOW_UP_ACTION],
      patchResult: {
        status: 409,
        body: {
          success: false,
          error: {
            code: "STALE_UPDATE",
            message: "This action was updated by someone else.",
            conflict: { expectedVersion: 1, currentVersion: 2, current: latest },
          },
        },
      },
    });

    render(<ActionsTaken ticketId={101} currentUser={STAFF_USER} />);
    await screen.findByText(FOLLOW_UP_ACTION.description);
    await userEvent.click(screen.getByRole("button", { name: /Edit Action Taken/ }));

    const description = screen.getByLabelText(/Action Description/);
    await userEvent.clear(description);
    await userEvent.type(description, "My unsaved draft.");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("This action was updated by another user."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Action Description/)).toHaveValue("My unsaved draft.");
    expect(screen.getAllByText(/Server latest description/).length).toBeGreaterThan(0);

    const patchCall = fetchMock.mock.calls.find(
      ([, init]) => (init?.method ?? "GET").toUpperCase() === "PATCH",
    );
    expect(patchCall).toBeTruthy();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      version: 1,
      description: "My unsaved draft.",
    });

    await userEvent.click(screen.getByRole("button", { name: "Reload latest" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Action Description/)).toHaveValue(
        "Server latest description.",
      );
    });
    expect(
      screen.queryByText("This action was updated by another user."),
    ).not.toBeInTheDocument();
  });

  it("parses field-level validation errors and preserves the draft", async () => {
    const { fetchMock } = mockActionsApi({
      initial: [],
      postResult: {
        status: 400,
        body: {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Action details are invalid.",
            fields: { description: "Description must be more specific." },
          },
        },
      },
    });

    render(<ActionsTaken ticketId={101} currentUser={STAFF_USER} />);
    await screen.findByText("No Actions Taken yet.");
    await userEvent.click(screen.getByRole("button", { name: "Add Action Taken" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), "Short");
    await userEvent.type(screen.getByLabelText(/^Result/), "Done");
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    expect(await screen.findByText("Description must be more specific.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Action Description/)).toHaveValue("Short");
    expect(screen.getByLabelText(/^Result/)).toHaveValue("Done");
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => (init?.method ?? "GET").toUpperCase() === "POST",
      ),
    ).toHaveLength(1);
  });

  it("falls back safely when an API error body is not the standard envelope", async () => {
    mockActionsApi({
      initial: [],
      postResult: { status: 500, body: { message: "Unexpected server response." } },
    });

    render(<ActionsTaken ticketId={101} currentUser={STAFF_USER} />);
    await screen.findByText("No Actions Taken yet.");
    await userEvent.click(screen.getByRole("button", { name: "Add Action Taken" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), "Draft survives.");
    await userEvent.type(screen.getByLabelText(/^Result/), "Still here.");
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    expect(await screen.findByText("Unexpected server response.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Action Description/)).toHaveValue("Draft survives.");
  });

  it("keeps the saved action visible and warns when the post-save refresh fails", async () => {
    const created: ActionTakenItem = {
      ...PLAIN_ACTION,
      id: 999,
      description: "Saved before refresh failed.",
      result: "The mutation succeeded.",
    };
    const { getCount } = mockActionsApi({
      initial: [],
      afterSave: [created],
      created,
      refreshFailures: 1,
    });

    render(<ActionsTaken ticketId={101} currentUser={STAFF_USER} />);
    await screen.findByText("No Actions Taken yet.");
    await userEvent.click(screen.getByRole("button", { name: "Add Action Taken" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), created.description);
    await userEvent.type(screen.getByLabelText(/^Result/), created.result);
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    expect(await screen.findByText("Action Taken added.")).toBeInTheDocument();
    expect(await screen.findByText("The timeline could not refresh.")).toBeInTheDocument();
    expect(screen.getByText(created.description)).toBeInTheDocument();
    expect(getCount()).toBe(2);

    await userEvent.click(screen.getByRole("button", { name: "Retry refresh" }));

    await waitFor(() => {
      expect(screen.queryByText("The timeline could not refresh.")).not.toBeInTheDocument();
    });
    expect(screen.getByText(created.description)).toBeInTheDocument();
  });

  it("confirms before discarding an unsaved draft", async () => {
    mockActionsApi({ initial: [] });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<ActionsTaken ticketId={101} currentUser={STAFF_USER} />);
    await screen.findByText("No Actions Taken yet.");
    await userEvent.click(screen.getByRole("button", { name: "Add Action Taken" }));
    await userEvent.type(screen.getByLabelText(/Action Description/), "Unsaved draft.");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText(/Action Description/)).toHaveValue("Unsaved draft.");

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByLabelText(/Action Description/)).not.toBeInTheDocument();
    });
  });
});
