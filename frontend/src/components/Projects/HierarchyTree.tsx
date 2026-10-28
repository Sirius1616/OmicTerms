import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Microscope,
  MoreHorizontal,
  Pencil,
  Plus,
  TestTube,
  Trash2,
} from "lucide-react"
import { Fragment, useState } from "react"
import type { ProjectTreeNode } from "@/client"
import { EmptyState } from "@/components/Common/EmptyState"
import { PageHeader } from "@/components/Common/PageHeader"
import { Panel } from "@/components/Common/Panel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { documentsApi } from "@/services/documents"
import { hierarchyApi } from "@/services/hierarchy"
import { handleError } from "@/utils"

type EntityLevel = "project" | "experiment" | "sample"

type RenameTarget = { level: EntityLevel; id: string; name: string }

type DeleteTarget = {
  level: EntityLevel
  id: string
  name: string
  experiments: number
  samples: number
  documents: number
}

function cascadeCounts(
  level: EntityLevel,
  node: { experiments?: ProjectTreeNode["experiments"] },
  sampleDocCounts: Record<string, number>,
): { experiments: number; samples: number; documents: number } {
  if (level === "project") {
    const experiments = node.experiments ?? []
    const samples = experiments.reduce(
      (total, experiment) => total + (experiment.samples?.length ?? 0),
      0,
    )
    const documents = experiments.reduce(
      (total, experiment) =>
        total +
        (experiment.samples ?? []).reduce(
          (inner, sample) => inner + (sampleDocCounts[sample.id] ?? 0),
          0,
        ),
      0,
    )
    return { experiments: experiments.length, samples, documents }
  }
  return { experiments: 0, samples: 0, documents: 0 }
}

function experimentCounts(
  samples: { id: string }[],
  sampleDocCounts: Record<string, number>,
): { samples: number; documents: number } {
  return {
    samples: samples.length,
    documents: samples.reduce(
      (total, sample) => total + (sampleDocCounts[sample.id] ?? 0),
      0,
    ),
  }
}

function invalidateWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["hierarchy"] })
  queryClient.invalidateQueries({ queryKey: ["projectsTree"] })
  queryClient.invalidateQueries({ queryKey: ["documents"] })
}

function RenameDialog({
  target,
  onClose,
}: {
  target: RenameTarget | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [name, setName] = useState(target?.name ?? "")

  const mutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("nothing to rename")
      if (target.level === "project") {
        return hierarchyApi.updateProject(target.id, { name })
      }
      if (target.level === "experiment") {
        return hierarchyApi.updateExperiment(target.id, name)
      }
      return hierarchyApi.updateSample(target.id, name)
    },
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      showSuccessToast("Renamed successfully")
      onClose()
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename {target?.level}</DialogTitle>
          <DialogDescription>
            The new name applies everywhere the {target?.level} appears.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="rename-input">Name</Label>
          <Input
            id="rename-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || name.trim().length < 3}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({
  target,
  onClose,
}: {
  target: DeleteTarget | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("nothing to delete")
      if (target.level === "project")
        return hierarchyApi.deleteProject(target.id)
      if (target.level === "experiment") {
        return hierarchyApi.deleteExperiment(target.id)
      }
      return hierarchyApi.deleteSample(target.id)
    },
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      showSuccessToast("Deleted successfully")
      onClose()
    },
    onError: handleError.bind(showErrorToast),
  })

  const cascadeParts: string[] = []
  if (target && target.level !== "sample") {
    cascadeParts.push(
      `${target.experiments} ${
        target.experiments === 1 ? "experiment" : "experiments"
      }`,
      `${target.samples} ${target.samples === 1 ? "sample" : "samples"}`,
    )
  }
  if (target) {
    cascadeParts.push(
      `${target.documents} ${
        target.documents === 1 ? "document" : "documents"
      }`,
    )
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Delete {target?.level} “{target?.name}”?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes {cascadeParts.join(", ")} inside it. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateProjectDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const mutation = useMutation({
    mutationFn: () =>
      hierarchyApi.createProject(name, description || undefined),
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      showSuccessToast("Project created")
      setName("")
      setDescription("")
      onClose()
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Projects group experiments, samples, and their data files.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Methylation drift cohort"
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-description">Description (optional)</Label>
          <Input
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || name.trim().length < 3}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EntityActions({
  item,
  onRename,
  onDelete,
}: {
  item: { id: string; name: string }
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${item.name}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRename}>
          <Pencil className="size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ExperimentRow({
  experiment,
  docCounts,
  onRename,
  onDelete,
}: {
  experiment: {
    id: string
    name: string
    samples?: { id: string; name: string }[]
  }
  docCounts: Record<string, number>
  onRename: (target: RenameTarget) => void
  onDelete: (target: DeleteTarget) => void
}) {
  const counts = experimentCounts(experiment.samples ?? [], docCounts)
  return (
    <div
      className="flex items-center gap-2 border-b py-2 pr-2"
      style={{ paddingLeft: "2.5rem" }}
    >
      <Microscope
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-sm">{experiment.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {counts.samples} {counts.samples === 1 ? "sample" : "samples"}
      </span>
      <EntityActions
        item={experiment}
        onRename={() =>
          onRename({
            level: "experiment",
            id: experiment.id,
            name: experiment.name,
          })
        }
        onDelete={() =>
          onDelete({
            level: "experiment",
            id: experiment.id,
            name: experiment.name,
            experiments: 0,
            ...counts,
          })
        }
      />
    </div>
  )
}

function SampleRow({
  sample,
  docCounts,
  onRename,
  onDelete,
}: {
  sample: { id: string; name: string }
  docCounts: Record<string, number>
  onRename: (target: RenameTarget) => void
  onDelete: (target: DeleteTarget) => void
}) {
  return (
    <div
      data-testid="sample-row"
      className="flex items-center gap-2 border-b py-2 pr-2"
      style={{ paddingLeft: "4.5rem" }}
    >
      <TestTube className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm">{sample.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {docCounts[sample.id] ?? 0}{" "}
        {(docCounts[sample.id] ?? 0) === 1 ? "document" : "documents"}
      </span>
      <EntityActions
        item={sample}
        onRename={() =>
          onRename({ level: "sample", id: sample.id, name: sample.name })
        }
        onDelete={() =>
          onDelete({
            level: "sample",
            id: sample.id,
            name: sample.name,
            experiments: 0,
            samples: 0,
            documents: docCounts[sample.id] ?? 0,
          })
        }
      />
    </div>
  )
}

function ProjectRow({
  project,
  docCounts,
  expanded,
  onToggle,
  onRename,
  onDelete,
}: {
  project: ProjectTreeNode
  docCounts: Record<string, number>
  expanded: boolean
  onToggle: () => void
  onRename: (target: RenameTarget) => void
  onDelete: (target: DeleteTarget) => void
}) {
  const counts = cascadeCounts("project", project, docCounts)
  return (
    <>
      <div
        data-testid="project-row"
        className="flex items-center gap-2 border-b py-2 pr-2"
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${project.name}`}
          onClick={onToggle}
          className="rounded p-1 hover:bg-accent"
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <FolderKanban
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <Link
          to="/projects/$projectId"
          params={{ projectId: project.id }}
          className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
        >
          {project.name}
        </Link>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          Created {formatDateSafe(project.created_at)}
        </span>
        <EntityActions
          item={project}
          onRename={() =>
            onRename({ level: "project", id: project.id, name: project.name })
          }
          onDelete={() =>
            onDelete({
              level: "project",
              id: project.id,
              name: project.name,
              ...counts,
            })
          }
        />
      </div>
      {expanded &&
        (project.experiments ?? []).map((experiment) => (
          <Fragment key={experiment.id}>
            <ExperimentRow
              experiment={experiment}
              docCounts={docCounts}
              onRename={onRename}
              onDelete={onDelete}
            />
            {(experiment.samples ?? []).map((sample) => (
              <SampleRow
                key={sample.id}
                sample={sample}
                docCounts={docCounts}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </Fragment>
        ))}
    </>
  )
}

function formatDateSafe(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function ProjectsHierarchy() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const projectsQuery = useQuery({
    queryKey: ["projectsTree"],
    queryFn: () => hierarchyApi.listProjectsTree(),
  })

  const documentsQuery = useQuery({
    queryKey: ["documents", { forCounts: true }],
    queryFn: () => documentsApi.listDocuments({ limit: 100 }),
  })

  const projects = projectsQuery.data?.data ?? []
  const docCounts: Record<string, number> = {}
  for (const document of documentsQuery.data?.data ?? []) {
    docCounts[document.sample_id] = (docCounts[document.sample_id] ?? 0) + 1
  }

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-6" data-testid="projects-page">
      <PageHeader
        title="Projects"
        description="Manage your research hierarchy: projects contain experiments, which contain samples and their data files."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            New project
          </Button>
        }
      />

      <Panel
        title="Project hierarchy"
        subtitle="Expand a project to manage experiments and samples."
        icon={<FolderKanban className="size-4 text-muted-foreground" />}
        bodyClassName="p-0"
      >
        {projectsQuery.isPending ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : projectsQuery.isError ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <span>Could not load your projects.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => projectsQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            body="Create your first project, or upload data to be guided through creating one."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                New project
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col" data-testid="project-tree">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                docCounts={docCounts}
                expanded={expanded.has(project.id)}
                onToggle={() => toggle(project.id)}
                onRename={setRenameTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </Panel>

      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}
