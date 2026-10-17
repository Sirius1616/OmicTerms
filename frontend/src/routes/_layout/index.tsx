import { createFileRoute } from "@tanstack/react-router"

import { AcademyPanel } from "@/components/Dashboard/AcademyPanel"
import { ActivityTimelinePanel } from "@/components/Dashboard/ActivityTimelinePanel"
import { DashboardQuickActions } from "@/components/Dashboard/DashboardQuickActions"
import { EvidenceMapPanel } from "@/components/Dashboard/EvidenceMapPanel"
import { EvidenceQualityPanel } from "@/components/Dashboard/EvidenceQualityPanel"
import { KeyFindingsPanel } from "@/components/Dashboard/KeyFindingsPanel"
import { RecentFilesPanel } from "@/components/Dashboard/RecentFilesPanel"
import { SummaryCards } from "@/components/Dashboard/SummaryCards"
import { WelcomeBanner } from "@/components/Dashboard/WelcomeBanner"
import useAuth from "@/hooks/useAuth"
import { useDashboardData } from "@/hooks/useDashboardData"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - OmicTerms",
      },
    ],
  }),
})

function Dashboard() {
  const { user } = useAuth()
  const dashboard = useDashboardData()

  const displayName =
    user?.full_name || user?.email?.split("@")[0] || "researcher"

  const isLoading =
    dashboard.documentsQuery.isPending || dashboard.projectsQuery.isPending
  const isError =
    dashboard.documentsQuery.isError || dashboard.projectsQuery.isError

  const retry = () => {
    dashboard.documentsQuery.refetch()
    dashboard.projectsQuery.refetch()
  }

  const actorName = user?.full_name || user?.email || "You"

  return (
    <div className="flex flex-col gap-4">
      <WelcomeBanner displayName={displayName} />

      <SummaryCards
        loading={isLoading}
        error={isError}
        onRetry={retry}
        counts={dashboard.counts}
        integrityTotal={dashboard.counts.documents}
        fixtures={dashboard.fixtures}
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <EvidenceMapPanel fixtures={dashboard.fixtures} />
        <KeyFindingsPanel fixtures={dashboard.fixtures} />
        <ActivityTimelinePanel
          events={dashboard.activity}
          actorName={actorName}
          fixtures={dashboard.fixtures}
          error={dashboard.documentsQuery.isError}
          onRetry={() => dashboard.documentsQuery.refetch()}
        />
        <div className="flex flex-col gap-4 xl:col-span-4">
          <EvidenceQualityPanel integrity={dashboard.integrity} />
          <RecentFilesPanel
            documents={dashboard.recentFiles}
            error={dashboard.documentsQuery.isError}
            onRetry={() => dashboard.documentsQuery.refetch()}
          />
        </div>
      </div>

      <DashboardQuickActions />
      <AcademyPanel fixtures={dashboard.fixtures} />
    </div>
  )
}
