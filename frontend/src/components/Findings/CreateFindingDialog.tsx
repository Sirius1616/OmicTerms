import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FlaskConical } from "lucide-react"
import { type ChangeEvent, useState } from "react"

import { RunsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { documentsApi } from "@/services/documents"
import { findingsApi } from "@/services/findings"
import { hierarchyApi } from "@/services/hierarchy"

/**
 * Story 31 — create a research claim tied to material: pick the project,
 * describe the claim (title + summary), and attach primary/supporting
 * evidence from that project's documents and analysis runs. The server
 * enforces the claim-to-evidence rule; this dialog never pretends otherwise.
 */

type EvidenceDraft = {
  target_type: "document" | "run"
  target_id: string
  role: "primary" | "supporting" | "contradicting"
}

export function CreateFindingDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [projectId, setProjectId] = useState("")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([])
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data: tree } = useQuery({
    queryKey: ["hierarchyCreateFinding"],
    queryFn: () => hierarchyApi.listProjectsTree(),
    enabled: open,
  })
  const { data: documents } = useQuery({
    queryKey: ["documentsCreateFinding"],
    queryFn: () => documentsApi.listDocuments({ limit: 100 }),
    enabled: open,
  })

  const projects = tree?.data ?? []
  const selectedProject = projects.find((project) => project.id === projectId)
  const projectSampleIds = new Set<string>(
    (selectedProject?.experiments ?? []).flatMap((experiment) =>
      (experiment.samples ?? []).map((sample) => sample.id),
    ),
  )
  const projectDocuments = (documents?.data ?? []).filter(
    (document) =>
      document.sample_id && projectSampleIds.has(document.sample_id),
  )

  const { data: runs } = useQuery({
    queryKey: ["runsCreateFinding", projectId],
    queryFn: () => RunsService.listProjectRuns({ projectId, limit: 100 }),
    enabled: open && Boolean(projectId),
  })
  const projectRuns = runs?.data ?? []

  const reset = () => {
    setTitle("")
    setSummary("")
    setEvidence([])
  }

  const toggleEvidence = (
    target_type: EvidenceDraft["target_type"],
    target_id: string,
    defaultRole: EvidenceDraft["role"] = "primary",
  ) => {
    setEvidence((rows) =>
      rows.some(
        (row) => row.target_type === target_type && row.target_id === target_id,
      )
        ? rows.filter(
            (row) =>
              !(row.target_type === target_type && row.target_id === target_id),
          )
        : [...rows, { target_type, target_id, role: defaultRole }],
    )
  }

  const setEvidenceRole = (
    target_type: EvidenceDraft["target_type"],
    target_id: string,
    role: EvidenceDraft["role"],
  ) =>
    setEvidence((rows) =>
      rows.map((row) =>
        row.target_type === target_type && row.target_id === target_id
          ? { ...row, role }
          : row,
      ),
    )

  const createMutation = useMutation({
    mutationFn: () =>
      findingsApi.createFinding(projectId, {
        title: title.trim(),
        summary: summary.trim(),
        evidence: evidence.map((row) => ({
          target_type: row.target_type,
          target_id: row.target_id,
          role: row.role,
        })),
      }),
    onSuccess: () => {
      showSuccessToast(
        evidence.length
          ? "Finding created with its evidence references"
          : "Finding created",
      )
      reset()
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: ["findings"] })
    },
    onError: (error) => {
      // Rule errors (e.g. unknown evidence target) carry the server rule.
      showErrorToast(`Failed to create finding: ${String(error)}`)
    },
  })

  const canSubmit = Boolean(
    projectId && title.trim() && summary.trim() && !createMutation.isPending,
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="sm:max-w-2xl"
        data-testid="create-finding-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-4" />
            New finding
          </DialogTitle>
          <DialogDescription>
            Record a research claim and tie it to the material that supports it.
            Publishing later requires at least one primary reference.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="finding-project">Project</Label>
            <Select
              value={projectId}
              onValueChange={(value) => {
                setProjectId(value)
                setEvidence([])
              }}
            >
              <SelectTrigger id="finding-project" aria-label="Project">
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No projects yet — upload data first.
                  </div>
                ) : null}
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="finding-title">Title</Label>
            <Input
              id="finding-title"
              data-testid="finding-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What the data shows, in one line"
              maxLength={256}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="finding-summary">Summary</Label>
            <textarea
              id="finding-summary"
              data-testid="finding-summary"
              className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={summary}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setSummary(event.target.value)
              }
              placeholder="Plain-language statement of the claim and what backs it"
              rows={3}
              maxLength={4000}
            />
          </div>

          <div className="grid gap-2">
            <Label>
              Evidence references (optional now, required to publish)
            </Label>
            {projectId ? (
              <>
                <div className="rounded-md border border-border/70 p-2">
                  <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Documents
                  </p>
                  {projectDocuments.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">
                      No documents in this project yet.
                    </p>
                  ) : null}
                  {projectDocuments.map((document) => (
                    <div
                      key={`document-${document.id}`}
                      className="flex items-center gap-2 px-1 py-1"
                      data-testid={`evidence-document-${document.id}`}
                    >
                      <input
                        id={`document-evidence-${document.id}`}
                        type="checkbox"
                        checked={evidence.some(
                          (row) =>
                            row.target_type === "document" &&
                            row.target_id === document.id,
                        )}
                        onChange={() => toggleEvidence("document", document.id)}
                        className="size-3.5 accent-current"
                      />
                      <label
                        htmlFor={`document-evidence-${document.id}`}
                        className="flex-1 truncate text-xs"
                      >
                        {document.filename || document.file_url}
                      </label>
                      {evidence.some(
                        (row) =>
                          row.target_type === "document" &&
                          row.target_id === document.id,
                      ) ? (
                        <Select
                          value={
                            evidence.find(
                              (row) =>
                                row.target_type === "document" &&
                                row.target_id === document.id,
                            )?.role
                          }
                          onValueChange={(role) =>
                            setEvidenceRole(
                              "document",
                              document.id,
                              role as EvidenceDraft["role"],
                            )
                          }
                        >
                          <SelectTrigger
                            className="h-7 w-32 text-xs"
                            aria-label="Role"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary">primary</SelectItem>
                            <SelectItem value="supporting">
                              supporting
                            </SelectItem>
                            <SelectItem value="contradicting">
                              contradicting
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="rounded-md border border-border/70 p-2">
                  <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Analysis runs
                  </p>
                  {projectRuns.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">
                      No recorded runs in this project yet.
                    </p>
                  ) : null}
                  {projectRuns.map((run) => (
                    <div
                      key={`run-${run.id}`}
                      className="flex items-center gap-2 px-1 py-1"
                      data-testid={`evidence-run-${run.id}`}
                    >
                      <input
                        id={`run-evidence-${run.id}`}
                        type="checkbox"
                        checked={evidence.some(
                          (row) =>
                            row.target_type === "run" &&
                            row.target_id === run.id,
                        )}
                        onChange={() => toggleEvidence("run", run.id)}
                        className="size-3.5 accent-current"
                      />
                      <label
                        htmlFor={`run-evidence-${run.id}`}
                        className="flex-1 truncate text-xs"
                      >
                        {run.tool_name}
                      </label>
                      {evidence.some(
                        (row) =>
                          row.target_type === "run" && row.target_id === run.id,
                      ) ? (
                        <Select
                          value={
                            evidence.find(
                              (row) =>
                                row.target_type === "run" &&
                                row.target_id === run.id,
                            )?.role
                          }
                          onValueChange={(role) =>
                            setEvidenceRole(
                              "run",
                              run.id,
                              role as EvidenceDraft["role"],
                            )
                          }
                        >
                          <SelectTrigger
                            className="h-7 w-32 text-xs"
                            aria-label="Role"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary">primary</SelectItem>
                            <SelectItem value="supporting">
                              supporting
                            </SelectItem>
                            <SelectItem value="contradicting">
                              contradicting
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pick a project to list its documents and runs.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
            loading={createMutation.isPending}
            data-testid="create-finding-submit"
          >
            Create finding
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
