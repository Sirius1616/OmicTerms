import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { FolderKanban, Microscope, RotateCcw } from "lucide-react"

import { EmptyState } from "@/components/Common/EmptyState"
import { PageHeader } from "@/components/Common/PageHeader"
import { Panel } from "@/components/Common/Panel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { hierarchyApi } from "@/services/hierarchy"
import { formatDate } from "@/utils/format"

export const Route = createFileRoute("/_layout/projects")({
  component: ProjectsPage,
  head: () => ({
    meta: [{ title: "Projects - OmicTerms" }],
  }),
})

function ProjectsPage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["projectsTree"],
    queryFn: () => hierarchyApi.listProjectsTree(),
  })

  const projects = data?.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Your research hierarchy: projects contain experiments, which contain samples and their data files."
      />

      <Panel
        title="Project hierarchy"
        subtitle="Read-only view. Full project management ships in Story 10."
        icon={<FolderKanban className="size-4 text-muted-foreground" />}
        bodyClassName="p-0"
      >
        {isPending ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <span>Could not load your projects.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RotateCcw className="size-4" />
              Retry
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            body="Projects are created when you upload data — you choose or create a project, experiment, and sample in the upload dialog."
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to="/documents">Go to Data Sources</Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {projects.map((project) => {
              const experiments = project.experiments ?? []
              const sampleCount = experiments.reduce(
                (total, experiment) =>
                  total + (experiment.samples?.length ?? 0),
                0,
              )
              return (
                <li key={project.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{project.name}</p>
                      {project.description ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {project.description}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Created {formatDate(project.created_at)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5">
                      <Microscope className="size-3.5" />
                      {experiments.length}{" "}
                      {experiments.length === 1 ? "experiment" : "experiments"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5">
                      {sampleCount} {sampleCount === 1 ? "sample" : "samples"}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
