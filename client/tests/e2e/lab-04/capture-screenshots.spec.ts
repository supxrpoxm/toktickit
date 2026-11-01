import { expect, test, type Page } from "@playwright/test";
import {
  REQUESTER_USER,
  STAFF_TWO,
  STAFF_USER,
  installLab4Mocks,
  seedLab4State,
  type Lab4Action,
  type Lab4State,
} from "./lab4-fixtures";

// Lab 4 (Issue 7) — Actions Taken and resolution evidence.
// Screenshots resolve relative to the client/ cwd (playwright config dir).
// ../artifacts/... from client/ lands in the repo-root artifacts/ folder.
const SCREENSHOT_ROOT = "../artifacts/lab-04/screenshots/actions-taken";

function buildAction(
  id: number,
  ticketId: number,
  performedBy: Lab4Action["performedBy"],
  actionAt: string,
  description: string,
  result: string,
  followUpRequired: boolean,
  followUpNote: string | null,
  attachmentNotes: string | null = null,
): Lab4Action {
  return {
    id,
    ticketId,
    actionAt,
    description,
    result,
    performedBy,
    followUpRequired,
    followUpNote,
    attachmentNotes,
    version: 1,
    createdAt: actionAt,
    updatedAt: actionAt,
  };
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_ROOT}/${name}`, fullPage: true });
}

async function openStaffTicket(page: Page, state: Lab4State, ticketId = 101) {
  await installLab4Mocks(page, state);
  await page.goto(`/staff/tickets/${ticketId}`);
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
}

test.describe("Lab 4 actions taken screenshot evidence", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("captures the staff Action Taken creation form", async ({ page }) => {
    const state = seedLab4State();
    await openStaffTicket(page, state);

    await page.getByRole("button", { name: "Add Action Taken" }).click();
    await expect(page.getByRole("heading", { name: "Add Action Taken" })).toBeVisible();

    await page.locator("#action-at").fill("2026-10-31T14:30");
    await page
      .getByLabel(/Action Description/)
      .fill("Replaced the expired VPN certificate and reloaded the profile.");
    await page
      .getByLabel(/^Result/)
      .fill("VPN authentication is restored and verified with the requester.");
    await page.getByLabel("Follow-up required?").check();
    await page
      .getByLabel(/Follow-up Note/)
      .fill("Confirm the requester can connect remotely tomorrow morning.");
    await page
      .getByLabel(/Attachment Notes/)
      .fill("VPN connection status screenshot attached to the ticket.");

    await expect(page.getByLabel(/Action Description/)).toHaveValue(
      "Replaced the expired VPN certificate and reloaded the profile.",
    );
    await expect(page.getByLabel(/Follow-up Note/)).toHaveValue(
      "Confirm the requester can connect remotely tomorrow morning.",
    );

    await capture(page, "action-form-create.png");
  });

  test("captures multiple Actions Taken from different staff members", async ({ page }) => {
    const state = seedLab4State();
    state.tickets[0].actions.push(
      buildAction(
        601,
        101,
        { id: STAFF_USER.id, name: STAFF_USER.name, role: STAFF_USER.role },
        "2026-10-30T09:15:00.000Z",
        "Diagnosed the expired VPN certificate on the remote access gateway.",
        "Confirmed the certificate expired and prepared a replacement profile.",
        false,
        null,
        null,
      ),
      buildAction(
        602,
        101,
        { id: STAFF_TWO.id, name: STAFF_TWO.name, role: STAFF_TWO.role },
        "2026-10-31T11:45:00.000Z",
        "Installed the replacement certificate and tested the VPN connection.",
        "The requester can authenticate to the VPN again from the office network.",
        true,
        "Confirm remote access from home before closing the ticket.",
        "Gateway event log exported for the audit trail.",
      ),
    );

    await openStaffTicket(page, state);
    const actionsSection = page.locator("section[aria-labelledby='actions-taken-heading']");
    await expect(actionsSection.getByText(STAFF_USER.name)).toBeVisible();
    await expect(actionsSection.getByText(STAFF_TWO.name)).toBeVisible();
    await expect(
      actionsSection.getByText(
        "The requester can authenticate to the VPN again from the office network.",
      ),
    ).toBeVisible();

    await capture(page, "action-list-multiple.png");
  });

  test("captures the requester read-only Actions Taken timeline", async ({ page }) => {
    const state = seedLab4State();
    state.currentUser = REQUESTER_USER;
    state.tickets[1].actions.push(
      buildAction(
        603,
        102,
        { id: STAFF_TWO.id, name: STAFF_TWO.name, role: STAFF_TWO.role },
        "2026-10-31T08:20:00.000Z",
        "Verified the finance group membership from the directory console.",
        "Access is granted; waiting for the requester to sign out and back in.",
        false,
        null,
        null,
      ),
    );

    await installLab4Mocks(page, state);
    await page.goto("/tickets/102");
    await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
    await expect(
      page.getByText(
        "A read-only timeline of the work IT staff has recorded for this ticket.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Re-applied the finance group membership.")).toBeVisible();
    await expect(page.getByText(STAFF_TWO.name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Action Taken" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Edit Action Taken/ })).toHaveCount(0);

    await capture(page, "action-requester-readonly.png");
  });

  test("captures the Follow-Up Note validation error", async ({ page }) => {
    const state = seedLab4State();
    await openStaffTicket(page, state);

    await page.getByRole("button", { name: "Add Action Taken" }).click();
    await page
      .getByLabel(/Action Description/)
      .fill("Checked the certificate chain on the VPN gateway.");
    await page
      .getByLabel(/^Result/)
      .fill("The expired intermediate certificate was identified as the cause.");
    await page.getByLabel("Follow-up required?").check();

    await expect(
      page.getByText("Follow-up note is required when follow-up is required."),
    ).toBeVisible();
    await expect(page.locator("#action-followup-note")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await capture(page, "action-validation-error.png");
  });

  test("captures the resolution gate blocking a ticket with no Actions Taken", async ({
    page,
  }) => {
    const state = seedLab4State();
    await openStaffTicket(page, state);
    await expect(page.getByText(/Current status:/)).toContainText("In Progress");

    await page.getByRole("button", { name: "Resolved", exact: true }).click();
    await expect(
      page.getByText("Record at least one Action Taken before resolving this ticket."),
    ).toBeVisible();
    await expect(page.getByText(/Current status:/)).toContainText("In Progress");
    expect(state.tickets.find((ticket) => ticket.id === 101)?.status).toBe("In Progress");

    await capture(page, "workflow-resolution-blocked.png");
  });

  test("captures the requester advisory flag without changing the ticket status", async ({
    page,
  }) => {
    const state = seedLab4State();
    state.currentUser = REQUESTER_USER;
    await installLab4Mocks(page, state);

    await page.goto("/tickets/101");
    await expect(page.getByRole("heading", { name: "Resolution" })).toBeVisible();

    await page
      .getByLabel("Advisory note (optional)")
      .fill("I can connect to the VPN again, thank you.");
    await page.getByRole("button", { name: "Indicate Issue is Resolved" }).click();
    await expect(
      page.getByRole("heading", { name: "Signal that the problem appears resolved?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();

    await expect(page.getByText("You indicated this issue is resolved")).toBeVisible();
    await expect(page.getByText("In Progress", { exact: true }).first()).toBeVisible();

    const ticket = state.tickets.find((item) => item.id === 101);
    expect(ticket?.requesterResolved).toBe(true);
    expect(ticket?.status).toBe("In Progress");

    await capture(page, "workflow-advisory-flag.png");
  });
});
