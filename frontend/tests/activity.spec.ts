import { expect, test } from "@playwright/test"

// Story 33 — Activity & provenance timeline UI on real data (Story 32 events).
// Runs as the seeded superuser (storage state) and seeds activity through the
// API so the sequence and pagination are deterministic.

const API_BASE = process.env.VITE_API_URL ?? "http://localhost:8000"

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  expect(response.ok, `${method} ${path}`).toBeTruthy()
  return response.json()
}

async function apiUpload(
  token: string,
  sampleId: string,
  filename: string,
  content: string,
): Promise<Record<string, unknown>> {
  const form = new FormData()
  form.append(
    "file",
    new Blob([content], { type: "text/plain" }),
    filename,
  )
  form.append("sample_id", sampleId)
  const response = await fetch(`${API_BASE}/api/v1/documents/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  expect(response.ok, "upload").toBeTruthy()
  return response.json()
}

async function seedHierarchy(token: string, name: string) {
  const project = await api(token, "POST", "/projects/", { name })
  const experiment = await api(token, "POST", `/projects/${project.id}/experiments`, {
    name: `${name} Experiment`,
  })
  const sample = await api(token, "POST", `/experiments/${experiment.id}/samples`, {
    name: `${name} Sample`,
  })
  return { project, experiment, sample }
}

async function superuserToken(page: import("@playwright/test").Page) {
  await page.goto("/")
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  expect(token).toBeTruthy()
  return token as string
}

test("upload then rename then validate renders newest-first with correct actors", async ({
  page,
}) => {
  const token = await superuserToken(page)

  const { project, sample } = await seedHierarchy(token!, "Timeline")
  const doc = await apiUpload(token!, sample.id as string, "timeline.tsv", "gene\tS1\nTP53\t1\n")
  await api(token!, "PATCH", `/documents/${doc.id}`, { filename: "renamed-timeline.tsv" })
  await api(token!, "POST", `/documents/${doc.id}/validate`)

  await page.goto(`/projects/${project.id}/activity`)

  const rows = page.getByTestId("provenance-row")
  await expect(rows.first()).toBeVisible()

  // Newest first: validation.run, then rename, then upload (extraction job
  // events sit between them).
  const actions = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-action")),
  )
  const indexOf = (action: string) => actions.indexOf(action)
  expect(indexOf("validation.run")).toBeGreaterThanOrEqual(0)
  expect(indexOf("validation.run")).toBeLessThan(indexOf("document.renamed"))
  expect(indexOf("document.renamed")).toBeLessThan(indexOf("document.uploaded"))

  // Messages come from the payload.
  await expect(
    page.getByText('uploaded timeline.tsv', { exact: true }).first(),
  ).toBeVisible()
  await expect(
    page.getByText('renamed document “timeline.tsv” → “renamed-timeline.tsv”').first(),
  ).toBeVisible()

  // User events show the researcher; system/job events are visually distinct.
  await expect(page.getByTestId("event-actor-job").first()).toBeVisible()
  await expect(page.getByText("validation run found", { exact: false }).first()).toBeVisible()

  // Deep link from a document event to the document detail page.
  await page.getByRole("link", { name: "View" }).first().click()
  await page.waitForURL(/\/documents\//)
})

test("category filter narrows the timeline", async ({ page }) => {
  const token = await superuserToken(page)
  const { project } = await seedHierarchy(token!, "Filter")
  await page.goto(`/projects/${project.id}/activity?action=validation`)

  // A fresh project has no validation events: the filtered timeline is empty.
  await expect(page.getByText("No activity yet")).toBeVisible()
  await expect(page.getByTestId("provenance-row")).toHaveCount(0)
})

test("pagination loads more than the first page of events", async ({ page }) => {
  const token = await superuserToken(page)
  const { project, sample } = await seedHierarchy(token!, "Pagination")

  // Each upload produces upload + extraction.started + extraction.succeeded +
  // validation.run events, so ~14 uploads exceed the 50-event page size.
  for (let index = 0; index < 14; index += 1) {
    await apiUpload(
      token!,
      sample.id as string,
      `pagination-${index}.tsv`,
      "gene\tS1\nTP53\t1\n",
    )
  }

  await page.goto(`/projects/${project.id}/activity`)

  const rows = page.getByTestId("provenance-row")
  await expect(rows.first()).toBeVisible()
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="provenance-row"]').length >= 50,
    undefined,
    { timeout: 30000 },
  )
  const before = await rows.count()
  expect(before).toBeGreaterThanOrEqual(50)

  await page.getByRole("button", { name: "Load more" }).click()
  await expect
    .poll(async () => rows.count(), { timeout: 15000 })
    .toBeGreaterThan(before)
})

test("fresh project shows its creation event; no fixtures mixed in", async ({
  page,
}) => {
  const token = await superuserToken(page)
  const { project } = await seedHierarchy(token!, "Fresh")

  await page.goto(`/projects/${project.id}/activity`)
  await expect(page.getByText("No activity yet")).toHaveCount(0)
  await expect(
    page.locator('[data-testid="provenance-row"][data-action="project.created"]'),
  ).toHaveCount(1)
  // AC4: no fixture markers when the API returns real data.
  await expect(page.getByText("fixture", { exact: true })).toHaveCount(0)
})
