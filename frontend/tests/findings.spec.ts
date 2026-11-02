import AxeBuilder from "@axe-core/playwright"
import { expect, type Page, test } from "@playwright/test"

// Story 31 — Findings panel and detail UI, exercised against dev servers
// with the real backend (Story 30 REST surface). The claim-to-evidence rule
// lives server-side; the UI only reflects what the server decides.

const API_BASE = process.env.VITE_API_URL ?? "http://localhost:8000"
const password = "findings-password-123"

async function apiRegister(email: string) {
  const response = await fetch(`${API_BASE}/api/v1/users/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: "Finding Owner", email, password }),
  })
  expect(response.ok, "signup").toBeTruthy()
}

async function apiLogin(email: string) {
  const body = new URLSearchParams({ username: email, password })
  const response = await fetch(`${API_BASE}/api/v1/login/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  expect(response.ok, "login").toBeTruthy()
  const { access_token } = (await response.json()) as { access_token: string }
  return { Authorization: `Bearer ${access_token}` }
}

async function seedProjectWithDocument(
  headers: Record<string, string>,
): Promise<{ projectId: string; documentId: string; filename: string }> {
  const projectResponse = await fetch(`${API_BASE}/api/v1/projects/`, {
    method: "POST",
    headers: {
      Authorization: headers.Authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Findings P" }),
  })
  expect(projectResponse.status, "project").toBe(201)
  const project = await projectResponse.json()

  const experimentResponse = await fetch(
    `${API_BASE}/api/v1/projects/${project.id}/experiments`,
    {
      method: "POST",
      headers: {
        Authorization: headers.Authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Baseline" }),
    },
  )
  expect(experimentResponse.status, "experiment").toBe(201)
  const experiment = await experimentResponse.json()

  const sampleResponse = await fetch(
    `${API_BASE}/api/v1/experiments/${experiment.id}/samples`,
    {
      method: "POST",
      headers: {
        Authorization: headers.Authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Sample 1" }),
    },
  )
  expect(sampleResponse.status, "sample").toBe(201)
  const sample = await sampleResponse.json()

  const filename = `expression-${Date.now()}.tsv`
  const formData = new FormData()
  formData.append("sample_id", sample.id)
  formData.append(
    "file",
    new File(["gene\tcondition\nTP53\t2.1\n"], filename, {
      type: "text/plain",
    }),
  )
  const uploadResponse = await fetch(`${API_BASE}/api/v1/documents/`, {
    method: "POST",
    headers: { Authorization: headers.Authorization },
    body: formData,
  })
  expect(uploadResponse.status, "upload").toBe(201)
  const document = await uploadResponse.json()

  return { projectId: project.id, documentId: document.id, filename }
}

/** Create one finding through the shared UI dialog (from the dashboard). */
async function createFindingViaUi(
  page: Page,
  options: {
    title: string
    summary: string
    withDocumentEvidence: boolean
    documentId?: string
  },
) {
  await page.goto("/")
  await page.getByTestId("new-finding-button").first().click()
  const dialog = page.getByTestId("create-finding-dialog")
  await expect(dialog).toBeVisible()

  await dialog.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Findings P" }).click()

  await page.getByTestId("finding-title").fill(options.title)
  await page.getByTestId("finding-summary").fill(options.summary)

  if (options.withDocumentEvidence && options.documentId) {
    // Address the document row by id — run rows and document rows both
    // contain checkboxes, so a positional match is not deterministic.
    await dialog
      .getByTestId(`evidence-document-${options.documentId}`)
      .getByRole("checkbox")
      .check()
  }
  await page.getByTestId("create-finding-submit").click()
  await expect(page.getByText(/Finding created/)).toBeVisible({
    timeout: 10000,
  })
  await expect(dialog).toBeHidden()
}

async function openFinding(page: Page, title: string) {
  await page.goto("/")
  await page
    .getByTestId("findings-panel-list")
    .getByRole("link", { name: title })
    .click()
  await expect(page).toHaveURL(/\/findings\/.+$/)
}

function detailChip(page: Page, label: string) {
  return page
    .getByTestId("finding-detail")
    .getByText(label, { exact: true })
    .first()
}

// The journey runs as the finding owner (fresh registration), not the
// superuser storage state the suite logs in by default.
test.use({ storageState: { cookies: [], origins: [] } })

test("findings journey: create, validate, navigate evidence, publish rules, retract", async ({
  page,
}) => {
  const email = `finding-${Date.now()}@example.com`
  await apiRegister(email)
  const headers = await apiLogin(email)
  const { documentId, filename } = await seedProjectWithDocument(headers)
  expect(documentId).toBeTruthy()

  await page.goto("/login")
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(password)
  await page.getByRole("button", { name: "Log In" }).click()
  await page.waitForURL("/")

  // --- AC1: create via UI, appears in the dashboard panel ------------------
  await createFindingViaUi(page, {
    title: "TP53 expression shifts with condition",
    summary:
      "Candidate claim backed by the uploaded expression document; inspectable from the dashboard.",
    withDocumentEvidence: true,
    documentId,
  })
  await expect(
    page.getByText("TP53 expression shifts with condition").first(),
  ).toBeVisible()
  await expect(page.getByTestId("findings-panel-list")).toBeVisible()

  // --- AC2: the chip only turns after a successful deterministic call -------
  await openFinding(page, "TP53 expression shifts with condition")
  await expect(detailChip(page, "unvalidated")).toBeVisible()

  await page.getByTestId("validate-finding").click()
  await expect(page.getByTestId("validation-result-banner")).toContainText(
    "All deterministic checks passed",
  )
  await expect(detailChip(page, "validated")).toBeVisible()

  // --- AC3: the evidence deep link hits the real document ------------------
  await expect(page.locator('[data-testid^="evidence-link-"]')).toHaveCount(1)
  await page.locator('[data-testid^="evidence-link-"]').click()
  await expect(page).toHaveURL(new RegExp(`/documents/${documentId}$`))
  await expect(
    page.getByRole("heading", { name: filename }).first(),
  ).toBeVisible()

  // --- AC4: publish is refused without primary evidence ---------------------
  await createFindingViaUi(page, {
    title: "Orphan claim without references",
    summary: "Deliberately created without evidence to exercise the rule.",
    withDocumentEvidence: false,
  })
  await openFinding(page, "Orphan claim without references")
  await expect(detailChip(page, "unvalidated")).toBeVisible()

  await page.getByTestId("validate-finding").click()
  await expect(page.getByTestId("validation-result-banner")).toContainText(
    "Checks did not pass",
  )
  await expect(page.getByTestId("validation-result-banner")).toContainText(
    "finding.no_primary_evidence",
  )
  await expect(detailChip(page, "unvalidated")).toBeVisible()

  await page.getByTestId("publish-finding").click()
  await expect(page.getByTestId("publish-confirm")).toBeVisible()
  await page
    .getByTestId("publish-confirm")
    .locator("button", { hasText: "Publish" })
    .click()
  await expect(page.getByText(/Publishing refused/)).toBeVisible({
    timeout: 10000,
  })
  await expect(page.getByTestId("publish-confirm")).toBeHidden()
  await expect(detailChip(page, "draft")).toBeVisible()

  // --- AC5: retract with explicit confirmation copy -------------------------
  await openFinding(page, "TP53 expression shifts with condition")
  await expect(detailChip(page, "published")).toBeHidden()
  await page.getByTestId("publish-finding").click()
  await expect(page.getByTestId("publish-confirm")).toBeVisible()
  await page
    .getByTestId("publish-confirm")
    .locator("button", { hasText: "Publish" })
    .click()
  await expect(detailChip(page, "published")).toBeVisible()
  await expect(
    page.getByText(/Published claims keep their evidence set frozen/),
  ).toBeVisible()

  await page.getByTestId("retract-finding").click()
  await expect(page.getByTestId("retract-confirm")).toBeVisible()
  await expect(
    page.getByTestId("retract-confirm").getByText("withdraws"),
  ).toBeVisible()
  await page.getByTestId("retract-confirm-button").click()
  await expect(detailChip(page, "retracted")).toBeVisible()
  await expect(page.getByTestId("retraction-notice")).toBeVisible()

  // --- AC6: the detail page is axe-clean -----------------------------------
  await openFinding(page, "Orphan claim without references")
  const axeResults = await new AxeBuilder({ page })
    .include('[data-testid="finding-detail"]')
    .analyze()
  const violations = axeResults.violations.filter(
    (v) => v.id !== "color-contrast",
  )
  expect(
    violations.map((v) => `${v.id}: ${JSON.stringify(v.nodes[0]?.target)}`),
  ).toEqual([])
})
