import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import {
  Activity,
  ChevronRight,
  FolderKanban,
  Microscope,
  TestTube,
} from "lucide-react"

import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import { Panel } from "@/components/Common/Panel"
import { columns } from "@/components/Documents/columns"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { documentsApi } from "@/services/documents"
import { hierarchyApi } from "@/services/hierarchy"

export const Route = createFileRoute("/_layout/projects/$projectId")({
  component: ProjectDetail,
  head: () => ({
    meta: [{ title: "Project - OmicTerms" }],
  }),
})

function ProjectDetail() {
  const { projectId } = Route.useParams()

  const projectQuery = useQuery({
    queryKey: ["project-tree", projectId],
    queryFn: () => hierarchyApi.getProjectTree(projectId),
  })

  const documentsQuery = useQuery({
    queryKey: ["documents", { forProject: projectId }],
    queryFn: () => documentsApi.listDocuments({ limit: 100 }),
  })

  const project = projectQuery.data
  const projectDocuments = (documentsQuery.data?.data ?? []).filter(
    (document) =>
      (project?.experiments ?? []).some((experiment) =>
        (experiment.samples ?? []).some(
          (sample) => sample.id === document.sample_id,
        ),
      ),
  )

  if (projectQuery.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (projectQuery.isError || !project) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Project not available"
        body="It may have been deleted, or it belongs to another researcher."
        action={
          <Button variant="outline" size="sm" asChild>
            <RouterLink to="/projects">Back to projects</RouterLink>
          </Button>
        }
      />
    )
  }

  const experiments = project.experiments ?? []
  const sampleCount = experiments.reduce(
    (total, experiment) => total + (experiment.samples?.length ?? 0),
    0,
  )

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
        <RouterLink
          to="/projects"
          className="text-muted-foreground hover:underline"
        >
          Projects
        </RouterLink>
        <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="font-medium">{project.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : null}
          <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Microscope className="size-3.5" aria-hidden />
              {experiments.length}{" "}
              {experiments.length === 1 ? "experiment" : "experiments"}
            </span>
            <span className="inline-flex items-center gap-1">
              <TestTube className="size-3.5" aria-hidden />
              {sampleCount} {sampleCount === 1 ? "sample" : "samples"}
            </span>
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <RouterLink
            to="/projects/$projectId/activity"
            params={{ projectId: project.id }}
          >
            <Activity className="mr-2 size-4" />
            View activity
          </RouterLink>
        </Button>
      </div>

      <Panel
        title="Experiments"
        subtitle="Experiments and samples inside this project."
        icon={<Microscope className="size-4 text-muted-foreground" />}
        bodyClassName="p-0"
      >
        {experiments.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No experiments yet — upload data to create the hierarchy.
          </div>
        ) : (
          <ul className="flex flex-col divide-y">
            {experiments.map((experiment) => (
              <li key={experiment.id} className="px-4 py-3">
                <p className="text-sm font-medium">{experiment.name}</p>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {(experiment.samples ?? []).map((sample) => (
                    <li
                      key={sample.id}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <TestTube className="size-3" aria-hidden />
                      {sample.name}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Documents"
        subtitle="Data files under this project, any experiment or sample."
        bodyClassName="p-0"
      >
        {documentsQuery.isPending ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : projectDocuments.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No documents in this project yet.
          </div>
        ) : (
          <DataTable columns={columns} data={projectDocuments} />
        )}
      </Panel>
    </div>
  )
}
