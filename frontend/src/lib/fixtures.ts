export const FIXTURE_STORAGE_KEY = "omiterms:fixtures"
export const FIXTURE_CHANGE_EVENT = "omiterms:fixtures-change"

/**
 * Dev-fixture mode is development-only. Production builds must never activate
 * it, and the fixture modules are excluded from production bundles.
 */
export function isFixtureModeEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    return localStorage.getItem(FIXTURE_STORAGE_KEY) === "on"
  } catch {
    return false
  }
}

export function setFixtureModeEnabled(enabled: boolean): void {
  if (!import.meta.env.DEV) return
  try {
    localStorage.setItem(FIXTURE_STORAGE_KEY, enabled ? "on" : "off")
  } catch {
    // ignore storage failures (private mode)
  }
  window.dispatchEvent(new Event(FIXTURE_CHANGE_EVENT))
}

export function subscribeFixtureMode(callback: () => void): () => void {
  window.addEventListener(FIXTURE_CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(FIXTURE_CHANGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}
