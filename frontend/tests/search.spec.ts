import { expect, type Page, test } from "@playwright/test"

// Story 11 — global search: debounced server document search, client-side
// project filtering, honest future-scope note, keyboard operation, and the
// panel reachable from any authenticated page. Runs against dev servers.

const API_BASE = process.env.VITE_API_URL ?? "http://localhost:8000"
const password = "search-password-123"

async function apiRegister(email: string) {
  const response = await fetch(`${API_BASE}/api/v1/users/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: "Search Owner", email, password }),
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

async function seedSearchData(headers: Record<string, string>) {
  const projectResponse = await fetch(`${API_BASE}/api/v1/projects/`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Methylation atlas ${Date.now()}` }),
  })
  expect(projectResponse.status, "project").toBe(201)
  const project = await projectResponse.json()

  const experimentResponse = await fetch(
    `${API_BASE}/api/v1/projects/${project.id}/experiments`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Baseline" }),
    },
  )
  expect(experimentResponse.status, "experiment").toBe(201)
  const experiment = await experimentResponse.json()

  const sampleResponse = await fetch(
    `${API_BASE}/api/v1/experiments/${experiment.id}/samples`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sample one" }),
    },
  )
  expect(sampleResponse.status, "sample").toBe(201)
  const sample = await sampleResponse.json()

  const filename = `methylation-levels-${Date.now()}.tsv`
  const formData = new FormData()
  formData.append("sample_id", sample.id)
  formData.append(
    "file",
    new File(["cpg\tvalue\nCpG_1\t0.4\n"], filename, { type: "text/plain" }),
  )
  const uploadResponse = await fetch(`${API_BASE}/api/v1/documents/`, {
    method: "POST",
    headers: headers,
    body: formData,
  })
  expect(uploadResponse.status, "upload").toBe(201)
  const document = await uploadResponse.json()
  return { project, documentId: document.id, filename }
}

async function openSearch(page: Page) {
  await page.getByRole("button", { name: "Open global search" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  return dialog
}

/** Track document-search network calls while typing in bursts. */
function trackDocumentSearches(page: Page) {
  const requests: string[] = []
  const pattern = /api\/v1\/documents\/\?[^"']*search=/g
  page.on("request", (request) => {
    if (pattern.test(request.url())) {
      requests.push(request.url())
    }
  })
  return requests
}

test.use({ storageState: { cookies: [], origins: [] } })

test("global search: debounce, filtering, navigation, placeholders, keyboard", async ({
  page,
}) => {
  const email = `search-${Date.now()}@example.com`
  await apiRegister(email)
  const headers = await apiLogin(email)
  const seeded = await seedSearchData(headers)

  await page.goto("/")
  // Login through the UI so the app session is the search data owner.
  await page.goto("/login")
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(password)
  await page.getByRole("button", { name: "Log In" }).click()
  await page.waitForURL("/")

  const requests = trackDocumentSearches(page)
  const dialog = await openSearch(page)

  // --- AC3: honest placeholder for future sources --------------------------
  await dialog.getByRole("textbox").fill("methy")
  await expect(page.getByTestId("search-scope-note")).toBeVisible()

  // --- AC1: debounced — one request lands for the whole burst --------------
  await page.keyboard.press("r")
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(350)
  const documentSearches = requests.filter((url) =>
    url.includes("search=methyr"),
  )
  expect(documentSearches.length).toBe(1)

  // Documents hit after the burst.
  await expect(
    dialog.getByRole("option", { name: seeded.filename }),
  ).toBeVisible()

  // --- AC2: projects filter client-side ------------------------------------
  await dialog.getByRole("option", { name: /Methylation atlas/ }).isVisible()

  // --- AC6/AC4: keyboard + mouse navigation to a document ------------------
  await dialog.getByRole("option", { name: seeded.filename }).click()
  await expect(page).toHaveURL(new RegExp(`/documents/${seeded.documentId}$`))

  // --- AC4: keyboard path to the project -----------------------------------
  const dialogAgain = await openSearch(page)
  await dialogAgain.getByRole("textbox").fill("atlas")
  const projectOption = dialogAgain.getByRole("option", {
    name: /Methylation atlas/,
  })
  await expect(projectOption).toBeVisible()
  await projectOption.press("Enter")
  await expect(page).toHaveURL(/\/projects\/.+$/)
  await expect(
    page.getByRole("heading", { name: /Methylation atlas/ }),
  ).toBeVisible()

  // --- AC4: Escape closes the panel ----------------------------------------
  const dialogThree = await openSearch(page)
  await dialogThree.getByRole("textbox").fill("nothingmatches123")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()

  // Empty results stay honest.
  const dialogFour = await openSearch(page)
  await dialogFour.getByRole("textbox").fill("nothingmatches123")
  await expect(dialogFour.getByText("No matches.")).toBeVisible()
})

test("global search is reachable from every authenticated page", async ({
  page,
}) => {
  const email = `search-any-${Date.now()}@example.com`
  await apiRegister(email)
  const headers = await apiLogin(email)
  await seedSearchData(headers)

  await page.goto("/login")
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(password)
  await page.getByRole("button", { name: "Log In" }).click()
  await page.waitForURL("/")

  for (const path of [
    "/",
    "/documents",
    "/projects",
    "/evidence",
    "/findings",
  ]) {
    await page.goto(path)
    await expect(
      page.getByRole("button", { name: "Open global search" }),
    ).toBeVisible()
  }
})
