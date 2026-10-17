import { expect, test } from "@playwright/test"

test.describe("Dashboard", () => {
  test("greets the researcher and shows summary metrics", async ({ page }) => {
    await page.goto("/")

    await expect(
      page.getByRole("heading", { name: /Welcome back,/ }),
    ).toBeVisible()

    for (const label of [
      "Active projects",
      "Data files",
      "Data integrity",
      "Key findings",
      "Learning progress",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
  })

  test("renders the evidence, findings and activity panels", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(
      page.getByRole("heading", { name: "Multi-Omics Evidence Map" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Key Findings" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Recent activity" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Evidence quality" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Recent files" }),
    ).toBeVisible()
  })

  test("shows honest empty states without fixture data", async ({ page }) => {
    await page.goto("/")

    await expect(
      page.getByText("Your evidence graph will appear here"),
    ).toBeVisible()
    await expect(page.getByText("No findings yet")).toBeVisible()
    await expect(page.getByText("OmicTerms Academy")).toBeVisible()
    await expect(
      page.getByRole("progressbar", { name: "Academy progress" }),
    ).toBeVisible()
  })

  test("exposes quick actions", async ({ page }) => {
    await page.goto("/")

    for (const label of [
      "Upload data",
      "Run analysis",
      "Link evidence",
      "Generate report",
    ]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible()
    }
  })

  test("upload quick action opens the upload dialog", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("button", { name: "Upload data" }).click()
    await expect(
      page.getByRole("heading", { name: "Upload a data file" }),
    ).toBeVisible()
  })

  test("dev fixtures mode labels data and shows the global badge", async ({
    page,
  }) => {
    await page.goto("/")

    await page.getByRole("button", { name: "Help" }).click()
    await page
      .getByRole("menuitemcheckbox", { name: "Enable dev fixtures" })
      .click()

    await expect(page.getByTestId("dev-fixture-badge")).toBeVisible()
    await expect(
      page.getByText("Fixture — not real scientific data"),
    ).toBeVisible()
  })
})
