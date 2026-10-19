import { expect, test } from "@playwright/test"

test.use({ storageState: { cookies: [], origins: [] } })

async function primeFixtures(
  page: import("@playwright/test").Page,
  on: boolean,
) {
  await page.addInitScript((enabled) => {
    localStorage.setItem("access_token", "visual-check-token")
    localStorage.setItem("omiterms:fixtures", enabled ? "on" : "off")
  }, on)
}

test("evidence map renders connected, non-overlapping nodes", async ({
  page,
}) => {
  await primeFixtures(page, true)
  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "Multi-Omics Evidence Map" }),
  ).toBeVisible()

  const canvas = page.getByTestId("evidence-graph-canvas").first()
  await expect(canvas).toBeVisible()

  const nodes = page.locator(
    '[data-testid="evidence-graph-canvas"] button[aria-pressed]',
  )
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

  const edges = page.locator(
    '[data-testid="evidence-graph-canvas"] svg path[marker-end]',
  )
  expect(await edges.count()).toBeGreaterThanOrEqual(9)

  await expect(
    page.getByText("Fixture — not real scientific data").first(),
  ).toBeVisible()
  await expect(page.getByText("Certainty", { exact: true })).toBeVisible()
  await expect(page.getByText("Links", { exact: true })).toBeVisible()
})

test("selecting a node reveals the inspector and its links", async ({
  page,
}) => {
  await primeFixtures(page, true)
  await page.goto("/")

  await page
    .locator('[data-testid="evidence-graph-canvas"] button[aria-pressed]', {
      hasText: "Candidate finding",
    })
    .click()

  await expect(page.getByText(/Inferred — a candidate/)).toBeVisible()
  await expect(page.getByText("supports").first()).toBeVisible()
  await expect(page.getByText("produced").first()).toBeVisible()
})

test("empty state keeps the honest message and planned structure", async ({
  page,
}) => {
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
  await primeFixtures(page, true)
  await page.goto("/evidence")

  await expect(
    page.getByRole("heading", { name: "Evidence Graph" }),
  ).toBeVisible()
  await expect(page.getByText("How to read this map")).toBeVisible()
  await expect(page.getByText("Layers", { exact: true })).toBeVisible()
})
