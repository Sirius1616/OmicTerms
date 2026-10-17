import { useSyncExternalStore } from "react"

import {
  isFixtureModeEnabled,
  setFixtureModeEnabled,
  subscribeFixtureMode,
} from "@/lib/fixtures"

/**
 * Reads and toggles dev-fixture mode (development only). Always `false` in
 * production builds.
 */
export function useDevFixtures() {
  const enabled = useSyncExternalStore(
    subscribeFixtureMode,
    isFixtureModeEnabled,
    () => false,
  )

  return {
    enabled,
    toggle: () => setFixtureModeEnabled(!enabled),
    setEnabled: setFixtureModeEnabled,
  }
}
