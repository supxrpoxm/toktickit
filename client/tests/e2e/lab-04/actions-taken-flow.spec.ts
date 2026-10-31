import { expect, test } from "@playwright/test";
import {
  REQUESTER_USER,
  STAFF_USER,
  installLab4Mocks,
  seedLab4State,
} from "./lab4-fixtures";

test.describe("Lab 4 actions taken flow", () => {
  test("staff can add, validate, edit, and review an action", async ({ page }) => {
    const state = seedLab4State();
    await installLab4Mocks(page, state);

    await page.goto("/staff/tickets/101");
    await expect(page.getByRole("heading", { name: "VPN certificate expired" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();

    await page.getByRole("button", { name: "Add Action Taken" }).click();
    await page.getByRole("button", { name: "Save Action" }).click();
    await expect(page.getByText("Action description is required.")).toBeVisible();
    await expect(page.getByText("Result is required.")).toBeVisible();

    await page.getByLabel("Follow-up required?").check();
    await expect(
      page.getByText("Follow-up note is required when follow-up is required."),
    ).toBeVisible();

    await page
      .getByLabel(/Action Description/)
      .fill("Replaced the expired VPN certificate.");
    await page
      .getByLabel(/^Result/)
      .fill("VPN authentication is restored for the requester.");
    await page
      .getByLabel(/Follow-up Note/)
      .fill("Confirm the requester can connect remotely tomorrow.");

    await page.getByRole("button", { name: "Save Action" }).click();
    await expect(page.getByText("Action Taken added.")).toBeVisible();
    await expect(page.getByText("Replaced the expired VPN certificate.")).toBeVisible();
    await expect(page.getByText("Follow-up required")).toBeVisible();
    await expect(
      page.getByText("Confirm the requester can connect remotely tomorrow."),
    ).toBeVisible();

    expect(state.tickets.find((ticket) => ticket.id === 101)?.actions).toHaveLength(1);

    await page.getByRole("button", { name: /Edit Action Taken from/ }).click();
    await page
      .getByLabel(/^Result/)
      .fill("VPN authentication is restored and verified with the requester.");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Action Taken updated.")).toBeVisible();
    await expect(
      page.getByText("VPN authentication is restored and verified with the requester."),
    ).toBeVisible();
    await expect(page.getByText("Replaced the expired VPN certificate.")).toBeVisible();

    const savedAction = state.tickets.find((ticket) => ticket.id === 101)?.actions[0];
    expect(savedAction?.version).toBe(2);
    expect(savedAction?.result).toBe(
      "VPN authentication is restored and verified with the requester.",
    );

    await page.goto("/staff/dashboard");
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible();
    await expect(
      page.getByLabel("Incomplete actions: 2. Open filtered queue."),
    ).toBeVisible();
  });

  test("missing tickets show a neutral not-found state", async ({ page }) => {
    const state = seedLab4State();
    await installLab4Mocks(page, state);

    await page.goto("/staff/tickets/999");
    await expect(page.getByRole("heading", { name: "Ticket Not Found" })).toBeVisible();
    await expect(page.getByText("We couldn't find that ticket.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Back to My Queue/ })).toBeVisible();
  });

  test("requester sees a read-only timeline without staff controls", async ({ page }) => {
    const state = seedLab4State();
    state.currentUser = REQUESTER_USER;
    await installLab4Mocks(page, state);

    await page.goto("/tickets/102");

    await expect(
      page.getByRole("heading", { name: "Shared drive permissions missing" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
    await expect(
      page.getByText("A read-only timeline of the work IT staff has recorded for this ticket."),
    ).toBeVisible();
    await expect(page.getByText("Re-applied the finance group membership.")).toBeVisible();
    await expect(page.getByText("Confirm access after the group change.")).toBeVisible();
    await expect(page.getByText("Follow-up required")).toBeVisible();

    await expect(page.getByRole("button", { name: "Add Action Taken" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Edit Action Taken/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save Action" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  });
});
