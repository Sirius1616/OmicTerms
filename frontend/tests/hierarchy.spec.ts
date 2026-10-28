import { expect, test } from "@playwright/test"

// Story 10 — Project / Experiment / Sample management UI: create, rename,
// delete with exact cascade counts, keyboard-expandable tree, breadcrumbs.

const API_BASE = process.env.VITE_API_URL ?? "http://localhost:8000"

async function openMenuAndClick(
  page: import("@playwright/test").Page,
  item: string,
) {
  const menuItem = page.getByRole("menuitem", { name: item })
  await menuItem.waitFor({ state: "visible" })
  await page.waitForTimeout(300)
  await menuItem.click()
}

async function superuserToken(page: import("@playwright/test").Page) {
  await page.goto("/")
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  expect(token).toBeTruthy()
  return token as string
}

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
): Promise<Record<string, unknown>> {
  const form = new FormData()
  form.append(
    "file",
    new Blob(["gene\tS1\nTP53\t1\n"], { type: "text/plain" }),
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

test("create, rename, and delete each level of the hierarchy", async ({
  page,
}) => {
  const token = await superuserToken(page)
  const projectName = `Managed ${Date.now()}`

  // Create a project from the page.
  await page.goto("/projects")
  await page.getByRole("button", { name: "New project" }).first().click()
  await page.locator("#project-name").fill(projectName)
  await page.getByRole("button", { name: "Create", exact: true }).click()
  await expect(page.getByText("Project created")).toBeVisible()

  // It appears in the tree, linked to its detail page.
  const projectLink = page.getByRole("link", { name: projectName })
  await expect(projectLink).toBeVisible()

  // Rename the project.
  const row = page.getByTestId("project-row").filter({ hasText: projectName })
  await row.getByRole("button", { name: `Actions for ${projectName}` }).click()
  await openMenuAndClick(page, "Rename")
  await page.locator("#rename-input").fill(`${projectName} Renamed`)
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Renamed successfully")).toBeVisible()
  await expect(
    page.getByRole("link", { name: `${projectName} Renamed` }),
  ).toBeVisible()

  // Delete the (empty) project; cascade counts state 0 experiments etc.
  const renamed = `${projectName} Renamed`
  const renamedRow = page
    .getByTestId("project-row")
    .filter({ hasText: renamed })
  await renamedRow
    .getByRole("button", { name: `Actions for ${renamed}` })
    .click()
  await openMenuAndClick(page, "Delete")
  await expect(
    page.getByText("deletes 0 experiments, 0 samples, 0 documents"),
  ).toBeVisible()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByText("Deleted successfully")).toBeVisible()
  await expect(page.getByRole("link", { name: renamed })).toHaveCount(0)
})

test("expandable tree shows experiments and samples with cascade counts", async ({
  page,
}) => {
  const token = await superuserToken(page)
  const projectName = `Tree ${Date.now()}`

  const project = await api(token, "POST", "/projects/", { name: projectName })
  const experiment = await api(
    token,
    "POST",
    `/projects/${project.id}/experiments`,
    {
      name: `${projectName} Experiment`,
    },
  )
  const sample = await api(
    token,
    "POST",
    `/experiments/${experiment.id}/samples`,
    {
      name: `${projectName} Sample`,
    },
  )
  await apiUpload(token, sample.id as string, "tree-doc.tsv")

  await page.goto("/projects")
  const row = page.getByTestId("project-row").filter({ hasText: projectName })
  const expand = row.locator("button[aria-expanded]").first()
  await expand.click()
  await expect(expand).toHaveAttribute("aria-expanded", "true")

  // Experiment and sample rows appear; the sample shows its document count.
  await expect(page.getByText(`${projectName} Experiment`)).toBeVisible()
  await expect(page.getByText(`${projectName} Sample`).first()).toBeVisible()
  await expect(page.getByText(/^1 document$/).first()).toBeVisible()

  // Delete the sample with an exact cascade count of 1 document.
  const sampleRow = page
    .getByTestId("sample-row")
    .filter({ hasText: `${projectName} Sample` })
  await sampleRow
    .getByRole("button", { name: `Actions for ${projectName} Sample` })
    .click()
  await openMenuAndClick(page, "Delete")
  await expect(page.getByText("permanently deletes 1 document")).toBeVisible()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByText("Deleted successfully")).toBeVisible()
})

test("project detail shows breadcrumbs and the project's documents", async ({
  page,
}) => {
  const token = await superuserToken(page)
  const projectName = `Detail ${Date.now()}`

  const project = await api(token, "POST", "/projects/", { name: projectName })
  const experiment = await api(
    token,
    "POST",
    `/projects/${project.id}/experiments`,
    {
      name: `${projectName} Experiment`,
    },
  )
  const sample = await api(
    token,
    "POST",
    `/experiments/${experiment.id}/samples`,
    {
      name: `${projectName} Sample`,
    },
  )
  await apiUpload(token, sample.id as string, "detail-doc.tsv")

  await page.goto("/projects")
  await page.getByRole("link", { name: projectName }).click()

  // Breadcrumb: Projects / <project name>.
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible()
  await expect(page.getByText("detail-doc.tsv").first()).toBeVisible()

  // Data from other projects never appears: the table is project-scoped.
  await expect(page.getByText("tree-doc.tsv")).toHaveCount(0)
})
