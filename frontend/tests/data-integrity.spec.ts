import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

// Story 19 — Validation results UI: upload a broken fixture, inspect the
// Data integrity section, revalidate, and confirm cross-user denial does
// not leak data. Runs against dev servers; API base comes from VITE_API_URL.

const API_BASE = process.env.VITE_API_URL ?? "http://localhost:8000"
const password = "validation-password-123"

async function apiRegister(email: string) {
  const response = await fetch(`${API_BASE}/api/v1/users/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "Doc Owner",
      email,
      password,
    }),
  })
  expect(response.ok, "signup").toBeTruthy()
  return response.json()
}

async function apiLogin(email: string) {
  const body = new URLSearchParams({ username: email, password })
  const response = await fetch(`${API_BASE}/api/v1/login/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  expect(response.ok, "login").toBeTruthy()
  return (await response.json()).access_token
}

const BROKEN_VCF = `##fileformat=FAIL
this is not a valid vcf body
`

test("broken fixture: error issue appears, skipped reasons shown, revalidate appends a run", async ({
  page,
}) => {
  await page.goto("/documents")
  await page.getByRole("button", { name: "Upload Document" }).click()

  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.vcf",
    mimeType: "text/plain",
    buffer: Buffer.from(BROKEN_VCF),
  })

  // Create the project/experiment/sample hierarchy inline.
  const comboboxes = page.getByRole("combobox")
  await comboboxes.nth(1).click()
  await page.getByText("Create new project").click()
  await page.getByPlaceholder("Project name").fill("Integrity Project")
  await page.keyboard.press("Enter")
  await expect(page.getByPlaceholder("Project name")).toBeHidden()

  await comboboxes.nth(2).click()
  await page.getByText("Create new experiment").click()
  await page.getByPlaceholder("Experiment name").fill("Integrity Experiment")
  await page.keyboard.press("Enter")
  await expect(page.getByPlaceholder("Experiment name")).toBeHidden()

  await comboboxes.nth(3).click()
  await page.getByText("Create new sample").click()
  await page.getByPlaceholder("Sample name").fill("Integrity Sample")
  await page.keyboard.press("Enter")
  await expect(page.getByPlaceholder("Sample name")).toBeHidden()

  await page.getByRole("button", { name: "Upload", exact: true }).click()
  await expect(page.getByText("Document uploaded successfully")).toBeVisible()
  await expect(page.getByRole("dialog")).toBeHidden()

  await page.goto("/documents")
  await page.getByRole("link", { name: "Open", exact: true }).first().click()

  // AC1: a red error issue with a code appears within one poll/refetch.
  const dataIntegrity = page.getByTestId("data-integrity")
  await expect(dataIntegrity).toBeVisible()
  await expect(
    dataIntegrity.getByTestId("validation-issue-error").first(),
  ).toBeVisible({ timeout: 15000 })
  await expect(dataIntegrity.getByText(/VCF-[A-Z]+-\d+/).first()).toBeVisible()
  await expect(
    dataIntegrity.getByRole("heading", { name: "Errors" }),
  ).toBeVisible()

  // AC3: skipped reasons are rendered verbatim.
  await expect(
    dataIntegrity.getByTestId("validation-issue-skipped").first(),
  ).toBeVisible()
  await expect(
    dataIntegrity.getByText("assembly not declared").first(),
  ).toBeVisible()

  // AC2: revalidate appends a run and shows it as latest without losing history.
  await dataIntegrity.getByRole("button", { name: "Revalidate" }).click()
  await expect(page.getByText("Validation run completed")).toBeVisible()
  await expect(dataIntegrity.getByText(/Run 2 of 2/)).toBeVisible()
  await expect(
    dataIntegrity.getByTestId("validation-issue-error").first(),
  ).toBeVisible()

  // AC6: the section is axe-clean.
  const axeResults = await new AxeBuilder({ page })
    .include('[data-testid="data-integrity"]')
    .analyze()
  const violations = axeResults.violations.filter(
    (v) => v.id !== "color-contrast",
  )
  expect(violations).toEqual([])
})

test("cross-user document shows a backend-denied error state with no data leak", async ({
  page,
}) => {
  // Arrange: another user's document, created directly through the API.
  const ownerEmail = `integrity-other-${Date.now()}@example.com`
  await apiRegister(ownerEmail)
  const token = await apiLogin(ownerEmail)
  const authHeaders = { Authorization: `Bearer ${token}` }

  const project = await (
    await fetch(`${API_BASE}/api/v1/projects/`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Secret Project" }),
    })
  ).json()
  const experiment = await (
    await fetch(`${API_BASE}/api/v1/projects/${project.id}/experiments`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Secret Experiment" }),
    })
  ).json()
  const sample = await (
    await fetch(`${API_BASE}/api/v1/experiments/${experiment.id}/samples`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Secret Sample" }),
    })
  ).json()

  const form = new FormData()
  form.append(
    "file",
    new Blob([BROKEN_VCF], { type: "text/plain" }),
    "secret-counts.tsv",
  )
  form.append("sample_id", sample.id)
  const upload = await fetch(`${API_BASE}/api/v1/documents/`, {
    method: "POST",
    headers: authHeaders,
    body: form,
  })
  expect(upload.ok, "upload").toBeTruthy()
  const doc = await upload.json()

  // Act: open the other user's document detail page.
  await page.goto(`/documents/${doc.id}`)

  // Assert: the generic error boundary renders; nothing about the foreign
  // document leaks into the page. (Query retries delay the boundary.)
  await expect(page.getByTestId("error-component")).toBeVisible({
    timeout: 30000,
  })
  await expect(page.getByText("Something went wrong.")).toBeVisible()
  await expect(page.getByText("secret-counts.tsv")).toBeHidden()
  await expect(page.getByText("Secret Project")).toBeHidden()
})
