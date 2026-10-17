import { FileBarChart, Link2, PlayCircle, Upload } from "lucide-react"

import { QuickAction } from "@/components/Common/QuickAction"
import UploadDocument from "@/components/Documents/UploadDocument"

export function DashboardQuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      <UploadDocument
        trigger={
          <QuickAction
            icon={Upload}
            label="Upload data"
            description="Add a file to a project, experiment, and sample"
          />
        }
      />
      <QuickAction
        icon={PlayCircle}
        label="Run analysis"
        description="Differential expression, PCA, and more"
        disabledReason="Analysis tools arrive in M3 (Story 25)"
      />
      <QuickAction
        icon={Link2}
        label="Link evidence"
        description="Connect datasets to a finding"
        disabledReason="Evidence linking arrives in M3 (Story 30)"
      />
      <QuickAction
        icon={FileBarChart}
        label="Generate report"
        description="Build a report from your evidence"
        disabledReason="Reports arrive in M3 (Story 36)"
      />
    </div>
  )
}
