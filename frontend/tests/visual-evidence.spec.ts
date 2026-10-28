import type { Route } from "@playwright/test"
import { expect, type Page, test } from "@playwright/test"

test.use({ storageState: { cookies: [], origins: [] } })

async function primeFixtures(page: Page, on: boolean) {
  await page.addInitScript((enabled) => {
    localStorage.setItem("access_token", "visual-check-token")
    localStorage.setItem("omiterms:fixtures", enabled ? "on" : "off")
  }, on)
}

/**
 * Serves an empty real workspace (no projects — no documents) so the app's
 * real-data queries resolve without a backend and the fixture path can be
 * asserted deterministically.
 */
async function stubEmptyWorkspace(page: Page) {
  await page.route(/\/api\/v1\/users\/me\/?(\?.*)?$/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        email: "evidence-check@example.com",
        full_name: "Evidence Check",
        id: "u1",
        created_at: "2026-10-01T00:00:00Z",
      }),
    }),
  )
  await page.route(/\/api\/v1\/projects\/(?:\?.*)?$/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], count: 0 }),
    }),
  )
  await page.route(/\/api\/v1\/documents\/(?:\?.*)?$/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], count: 0 }),
    }),
  )
}

const NODE_SELECTOR =
  '[data-testid="evidence-graph-canvas"] [data-testid="evidence-node"]'
const EDGE_SELECTOR =
  '[data-testid="evidence-graph-canvas"] svg path[marker-end]'

test("evidence map renders connected, non-overlapping nodes", async ({
  page,
}) => {
  await stubEmptyWorkspace(page)
  await primeFixtures(page, true)
  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "Multi-Omics Evidence Map" }),
  ).toBeVisible()

  const canvas = page.getByTestId("evidence-graph-canvas").first()
  await expect(canvas).toBeVisible()
  await expect(page.locator(NODE_SELECTOR).first()).toBeVisible()

  const nodes = page.locator(NODE_SELECTOR)
  const count = await nodes.count()
  expect(count).toBeGreaterThanOrEqual(9)

  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  if (!canvasBox) throw new Error("no canvas box")

  const boxes: { x: number; y: number; width: number; height: number }[] = []
  for (let i = 0; i < count; i++) {
    const box = await nodes.nth(i).boundingBox()
    expect(box, `node ${i} has a box`).not.toBeNull()
    if (!box) continue
    boxes.push(box)
    expect(box.x, `node ${i} left`).toBeGreaterThanOrEqual(canvasBox.x - 2)
    expect(box.y, `node ${i} top`).toBeGreaterThanOrEqual(canvasBox.y - 2)
    expect(box.x + box.width, `node ${i} right`).toBeLessThanOrEqual(
      canvasBox.x + canvasBox.width + 2,
    )
    expect(box.y + box.height, `node ${i} bottom`).toBeLessThanOrEqual(
      canvasBox.y + canvasBox.height + 2,
    )
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const overlap =
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height
      expect(overlap, `nodes ${i} and ${j} must not overlap`).toBeFalsy()
    }
  }

  const edges = page.locator(EDGE_SELECTOR)
  expect(await edges.count()).toBeGreaterThanOrEqual(9)

  await expect(
    page.getByText("Fixture — not real scientific data").first(),
  ).toBeVisible()
  await expect(page.getByTestId("evidence-graph")).toBeVisible()
})

test("selecting a node reveals the inspector and its certainty", async ({
  page,
}) => {
  await stubEmptyWorkspace(page)
  await primeFixtures(page, true)
  await page.goto("/")

  await page
    .locator(NODE_SELECTOR, {
      hasText: "Candidate finding",
    })
    .click()

  await expect(page.getByText("Certainty:", { exact: false })).toBeVisible()
  await expect(page.getByText("Inferred", { exact: true })).toBeVisible()
})

test("empty state keeps the honest message and planned structure", async ({
  page,
}) => {
  await stubEmptyWorkspace(page)
  await primeFixtures(page, false)
  await page.goto("/")

  await expect(
    page.getByText("Your evidence graph will appear here"),
  ).toBeVisible()
  await expect(page.getByTestId("evidence-graph")).toBeVisible()
})

test("evidence page uses the full graph with identity legend", async ({
  page,
}) => {
  await stubEmptyWorkspace(page)
  await primeFixtures(page, true)
  await page.goto("/evidence")

  await expect(
    page.getByRole("heading", { level: 1, name: "Multi-Omics Evidence Map" }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { level: 2, name: "Multi-Omics Evidence Map" }),
  ).toBeVisible()
  await expect(page.getByText("How to read this map")).toBeVisible()
  // The full page renders the certainty and link legends.
  await expect(
    page.getByTestId("evidence-graph").getByText("Certainty"),
  ).toBeVisible()
  await expect(
    page.getByTestId("evidence-graph").getByText("Links", { exact: true }),
  ).toBeVisible()
})

test("real workspace data drives the graph with traceable sources", async ({
  page,
}) => {
  await primeFixtures(page, false)

  await page.route(/\/api\/v1\/users\/me\/?(\?.*)?$/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        email: "graph-check@example.com",
        full_name: "Graph Check",
        id: "u1",
        created_at: "2026-10-01T00:00:00Z",
      }),
    }),
  )

  await page.route(/\/api\/v1\/projects\/(?:\?.*)?$/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "p1",
            name: "Prostate study",
            description: "Multi-omics pilot",
            created_at: "2026-10-01T00:00:00Z",
            experiments: [],
          },
        ],
        count: 1,
      }),
    }),
  )

  // The evidence graph itself comes from the Story 28 endpoint; the payer of
  // document-kind identity and inspector facts is the documents listing.
  await page.route(/\/api\/v1\/projects\/p1\/graph(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nodes: [
          {
            id: "n1",
            entity_type: "project",
            entity_id: "p1",
            label: "Prostate study",
            project_id: "p1",
            created_at: "2026-10-01T00:00:00Z",
          },
          {
            id: "n2",
            entity_type: "experiment",
            entity_id: "e1",
            label: "Baseline",
            project_id: "p1",
            created_at: "2026-10-01T00:00:00Z",
          },
          {
            id: "n3",
            entity_type: "sample",
            entity_id: "s1",
            label: "Sample A",
            project_id: "p1",
            created_at: "2026-10-01T00:00:00Z",
          },
          {
            id: "n4",
            entity_type: "document",
            entity_id: "d1",
            label: "calls.vcf",
            project_id: "p1",
            created_at: "2026-10-02T00:00:00Z",
          },
        ],
        edges: [
          {
            id: "eg1",
            source_id: "n4",
            target_id: "n3",
            relation: "belongs_to",
            created_at: "2026-10-02T00:00:00Z",
          },
          {
            id: "eg2",
            source_id: "n3",
            target_id: "n2",
            relation: "belongs_to",
            created_at: "2026-10-02T00:00:00Z",
          },
          {
            id: "eg3",
            source_id: "n2",
            target_id: "n1",
            relation: "belongs_to",
            created_at: "2026-10-02T00:00:00Z",
          },
          {
            id: "eg4",
            source_id: "n3",
            target_id: "n1",
            relation: "supports",
            evidence_ref: { sha256: "b".repeat(64) },
            note: "promoter hypothesis",
            created_by: "u1",
            created_at: "2026-10-03T00:00:00Z",
          },
        ],
        truncated: false,
      }),
    }),
  )

  await page.route(/\/api\/v1\/documents\/(?:\?.*)?$/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "d1",
            file_url: "d1.vcf",
            filename: "calls.vcf",
            sample_id: "s1",
            uploaded_at: "2026-10-02T00:00:00Z",
            extraction_status: "success",
            data_type: "variants",
            sha256: "a".repeat(64),
            size_bytes: 1024,
          },
        ],
        count: 1,
      }),
    }),
  )

  await page.goto("/evidence")

  await expect(page.getByText(/Real workspace data/).first()).toBeVisible()

  const nodes = page.locator(NODE_SELECTOR)
  await expect(nodes).toHaveCount(4)

  const project = page.locator(NODE_SELECTOR, { hasText: "Prostate study" })
  const experiment = page.locator(NODE_SELECTOR, { hasText: "Baseline" })
  const sample = page.locator(NODE_SELECTOR, { hasText: "Sample A" })
  const variantDoc = page.locator(NODE_SELECTOR, { hasText: "calls.vcf" })

  await expect(project).toBeVisible()
  await expect(experiment).toBeVisible()
  await expect(sample).toBeVisible()
  await expect(variantDoc).toBeVisible()

  // Every drawn edge comes from the intercepted graph API: exactly the four
  // relations the server returned (3 structural belongs_to + 1 manual
  // supports); nothing is invented on the client.
  await expect(
    page.locator(EDGE_SELECTOR),
    "edges must exist in the API response only",
  ).toHaveCount(4)

  // Manual supports edges render dashed.
  await expect(
    page
      .locator(EDGE_SELECTOR)
      .evaluateAll(
        (paths) =>
          paths.filter((p) => p.getAttribute("stroke-dasharray") !== null)
            .length,
      ),
  ).resolves.toBeGreaterThanOrEqual(1)

  await variantDoc.click()
  await expect(
    page.getByText("sha256 aaaaaaaaaaaa…", { exact: false }),
  ).toBeVisible()

  await page.getByRole("link", { name: "Open source" }).click()
  await expect(page).toHaveURL(/\/documents\/d1$/)
})
