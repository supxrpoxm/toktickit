import { expect, test } from "@playwright/test";
import {
  REQUESTER_USER,
  installLab4Mocks,
  seedLab4State,
} from "./lab4-fixtures";

test.describe("Lab 4 ticket resolution gate", () => {
  test("staff must record an action before resolving a ticket", async ({ page }) => {
    const state = seedLab4State();
    await installLab4Mocks(page, state);

    await page.goto("/staff/tickets/101");
    await expect(page.getByRole("heading", { name: "VPN certificate expired" })).toBeVisible();
    await expect(page.getByText(/Current status:/)).toContainText("In Progress");

    await page.getByRole("button", { name: "Resolved", exact: true }).click();
    await expect(
      page.getByText("Record at least one Action Taken before resolving this ticket."),
    ).toBeVisible();
    await expect(page.getByText(/Current status:/)).toContainText("In Progress");
    expect(state.tickets.find((ticket) => ticket.id === 101)?.status).toBe("In Progress");

    await page.getByRole("button", { name: "Add Action Taken" }).click();
    await page
      .getByLabel(/Action Description/)
      .fill("Reissued the VPN profile and confirmed the service is reachable.");
    await page
      .getByLabel(/^Result/)
      .fill("The requester can authenticate to the VPN again.");
    await page.getByRole("button", { name: "Save Action" }).click();
    await expect(page.getByText("Action Taken added.")).toBeVisible();

    await page.getByRole("button", { name: "Resolved", exact: true }).click();
    await expect(page.getByText("Status changed to Resolved.")).toBeVisible();
    await expect(page.getByText(/Current status:/)).toContainText("Resolved");
    expect(state.tickets.find((ticket) => ticket.id === 101)?.status).toBe("Resolved");
  });

  test("requester advisory signal never changes the authoritative status", async ({ page }) => {
    const state = seedLab4State();
    state.currentUser = REQUESTER_USER;
    await installLab4Mocks(page, state);

    await page.goto("/tickets/101");
    await expect(page.getByRole("heading", { name: "VPN certificate expired" })).toBeVisible();
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
    await expect(page.getByRole("button", { name: "Indicate Issue is Resolved" })).toHaveCount(0);
  });
});
