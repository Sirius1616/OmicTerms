import { expect, test } from "@playwright/test"

const SIDEBAR_LINKS = [
  "Home",
  "Projects",
  "Data Sources",
  "Integrations",
  "Analysis Tools",
  "Evidence Graph",
  "Reports",
  "OmicTerms Academy",
  "Learning Path",
  "Concept Explorer",
  "Interactive Labs",
  "My Progress",
]

test.describe("Application shell", () => {
  test("sidebar exposes the research and academy navigation", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(
      page.getByText("Research Workspace", { exact: true }),
    ).toBeVisible()

    for (const label of SIDEBAR_LINKS) {
      await expect(
        page.getByRole("link", { name: label, exact: true }),
      ).toBeVisible()
    }
  })

  test("header shows breadcrumbs", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeVisible()
  })

  test("global search navigates to a page", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("button", { name: "Open global search" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    await dialog.getByRole("textbox").fill("Reports")
    await dialog.getByRole("option", { name: /^Reports/ }).click()

    await expect(page).toHaveURL(/\/reports$/)
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible()
  })

  test("keyboard shortcut opens global search", async ({ page }) => {
    await page.goto("/")

    await page.keyboard.press("ControlOrMeta+k")
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("notifications menu shows an empty state", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("button", { name: "Notifications" }).click()
    await expect(page.getByText(/caught up/)).toBeVisible()
  })

  test("help menu lists documentation and dev tools", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("button", { name: "Help" }).click()
    await expect(
      page.getByRole("menuitem", { name: "Documentation" }),
    ).toBeVisible()
    await expect(
      page.getByRole("menuitemcheckbox", { name: "Enable dev fixtures" }),
    ).toBeVisible()
  })

  test("footer links to the repository", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByRole("link", { name: /Source & docs/ }),
    ).toBeVisible()
  })

  test("navigating to a planned section shows its placeholder", async ({
    page,
  }) => {
    await page.goto("/")

    await page.getByRole("link", { name: "Integrations", exact: true }).click()

    await expect(page).toHaveURL(/\/integrations$/)
    await expect(
      page.getByRole("heading", { name: "Integrations" }),
    ).toBeVisible()
    await expect(page.getByText(/not yet implemented/)).toBeVisible()
  })
})
