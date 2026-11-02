import { expect, type Page, test } from "@playwright/test"

// Story 12 — notifications bell with session toasts and contextual help.
// Upload outcomes mirror into the bell (client-side only, no persistence);
// the help menu picks a per-route topic; fake system notifications never
// appear. Runs against dev servers with the real backend.

const API_BASE = process.env.VITE_API_URL ?? "http://localhost:8000"
const password = "notify-password-123"

async function apiRegister(email: string) {
  const response = await fetch(`${API_BASE}/api/v1/users/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: "Notify Owner", email, password }),
  })
  expect(response.ok, "signup").toBeTruthy()
}

async function loginViaUi(page: Page, email: string) {
  await page.goto("/login")
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(password)
  await page.getByRole("button", { name: "Log In" }).click()
  await page.waitForURL("/")
}

/**
 * Uploads a document through the UI on /documents (inline hierarchy
 * creation), which both creates the dataset and pushes a session event.
 */
async function uploadViaUi(page: Page) {
  await page.goto("/documents")
  await page.getByRole("button", { name: "Upload Document" }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: "levels.tsv",
    mimeType: "text/plain",
    buffer: Buffer.from("cpg\tvalue\nCpG_1\t0.4\n"),
  })

  const comboboxes = page.getByRole("combobox")
  await comboboxes.nth(1).click()
  await page.getByText("Create new project").click()
  await page.getByPlaceholder("Project name").fill("Notify Project")
  await page.keyboard.press("Enter")
  await expect(page.getByPlaceholder("Project name")).toBeHidden()

  await comboboxes.nth(2).click()
  await page.getByText("Create new experiment").click()
  await page.getByPlaceholder("Experiment name").fill("Notify Experiment")
  await page.keyboard.press("Enter")
  await expect(page.getByPlaceholder("Experiment name")).toBeHidden()

  await comboboxes.nth(3).click()
  await page.getByText("Create new sample").click()
  await page.getByPlaceholder("Sample name").fill("Notify Sample")
  await page.keyboard.press("Enter")
  await expect(page.getByPlaceholder("Sample name")).toBeHidden()

  await page.getByRole("button", { name: "Upload", exact: true }).click()
  await expect(
    page.getByText("Document uploaded successfully").first(),
  ).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole("dialog")).toBeHidden()
}

test.use({ storageState: { cookies: [], origins: [] } })

test("notifications and contextual help", async ({ page }) => {
  const email = `notify-${Date.now()}@example.com`
  await apiRegister(email)
  await loginViaUi(page, email)

  // AC5: the Story 1 empty state remains before any session events.
  await page.getByRole("button", { name: "Notifications" }).click()
  await expect(page.getByText("You’re all caught up")).toBeVisible()
  await page.keyboard.press("Escape")

  // AC1: an upload outcome is listed in the bell with the announced count.
  await uploadViaUi(page)

  const liveCount = page.getByTestId("notifications-live-count")
  await expect(liveCount).toHaveText("1 new notification")

  await page.getByRole("button", { name: "Notifications" }).click()
  const notificationItem = page.getByTestId("notification-item")
  await expect(notificationItem).toHaveCount(1)
  await expect(notificationItem).toContainText("Document uploaded")
  await expect(notificationItem).toContainText("levels.tsv")

  // AC1: reading the bell clears the events back to the empty state.
  await page.keyboard.press("Escape")
  await expect(liveCount).toHaveText("No new notifications")
  await page.getByRole("button", { name: "Notifications" }).click()
  await expect(page.getByText("You’re all caught up")).toBeVisible()
  await page.keyboard.press("Escape")

  // AC2: the help topic follows the route.
  await page.goto("/documents")
  await page.getByRole("button", { name: "Help" }).click()
  await expect(page.getByTestId("help-route-topic")).toContainText(
    "How upload validation works",
  )
  await page.keyboard.press("Escape")

  await page.goto("/projects")
  await page.getByRole("button", { name: "Help" }).click()
  await expect(page.getByTestId("help-route-topic")).toContainText(
    "Organising projects",
  )
})
