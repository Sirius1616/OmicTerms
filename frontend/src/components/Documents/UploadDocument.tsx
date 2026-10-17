import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileUp } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { hierarchyApi } from "@/services/hierarchy"
import { DATA_TYPES } from "@/types/documents"
import { handleError } from "@/utils"

const NEW = "__new__"

const UploadDocument = ({
  trigger,
}: {
  /** Optional custom trigger; defaults to the standard "Upload Document" button. */
  trigger?: ReactNode
} = {}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [projectId, setProjectId] = useState("")
  const [experimentId, setExperimentId] = useState("")
  const [sampleId, setSampleId] = useState("")
  const [dataType, setDataType] = useState("auto")
  const [creatingProject, setCreatingProject] = useState(false)
  const [creatingExperiment, setCreatingExperiment] = useState(false)
  const [creatingSample, setCreatingSample] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data: tree, isFetching } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: () => hierarchyApi.listProjectsTree(),
    enabled: isOpen,
  })

  const projects = tree?.data ?? []
  const selectedProject = projects.find((project) => project.id === projectId)
  const experiments = selectedProject?.experiments ?? []
  const selectedExperiment = experiments.find(
    (experiment) => experiment.id === experimentId,
  )
  const samples = selectedExperiment?.samples ?? []

  const invalidateHierarchy = () =>
    queryClient.invalidateQueries({ queryKey: ["hierarchy"] })

  const createProjectMutation = useMutation({
    mutationFn: (name: string) => hierarchyApi.createProject(name),
    onSuccess: (created) => {
      showSuccessToast("Project created")
      setProjectId(created.id)
      setCreatingProject(false)
      setCreatingExperiment(false)
      setExperimentId("")
      invalidateHierarchy()
    },
    onError: handleError.bind(showErrorToast),
  })

  const createExperimentMutation = useMutation({
    mutationFn: (name: string) =>
      hierarchyApi.createExperiment(projectId, name),
    onSuccess: (created) => {
      showSuccessToast("Experiment created")
      setExperimentId(created.id)
      setCreatingExperiment(false)
      setCreatingSample(false)
      invalidateHierarchy()
    },
    onError: handleError.bind(showErrorToast),
  })

  const createSampleMutation = useMutation({
    mutationFn: (name: string) => hierarchyApi.createSample(experimentId, name),
    onSuccess: (created) => {
      showSuccessToast("Sample created")
      setSampleId(created.id)
      setCreatingSample(false)
      invalidateHierarchy()
    },
    onError: handleError.bind(showErrorToast),
  })

  const uploadMutation = useMutation({
    mutationFn: (payload: { file: File; sampleId: string }) =>
      documentsApi.uploadDocument(payload.file, payload.sampleId, dataType),
    onSuccess: () => {
      showSuccessToast("Document uploaded successfully")
      setFile(null)
      setSampleId("")
      setDataType("auto")
      setIsOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
    },
  })

  const onProjectChange = (value: string) => {
    if (value === NEW) {
      setCreatingProject(true)
      setProjectId("")
      setExperimentId("")
      setSampleId("")
      return
    }
    setCreatingProject(false)
    setProjectId(value)
    setExperimentId("")
    setSampleId("")
  }

  const onExperimentChange = (value: string) => {
    if (value === NEW) {
      setCreatingExperiment(true)
      setExperimentId("")
      setSampleId("")
      return
    }
    setCreatingExperiment(false)
    setExperimentId(value)
    setSampleId("")
  }

  const onSampleChange = (value: string) => {
    if (value === NEW) {
      setCreatingSample(true)
      setSampleId("")
      return
    }
    setCreatingSample(false)
    setSampleId(value)
  }

  const onSubmit = () => {
    if (!file || !sampleId) return
    uploadMutation.mutate({ file, sampleId })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <FileUp className="mr-2" />
            Upload Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a data file</DialogTitle>
          <DialogDescription>
            Variant calls, coverage tracks, expression or methylation matrices,
            or a report. OmicTerms detects the format and records provenance.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>File</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.eml,.tsv,.csv,.vcf,.bed"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Data type</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                {DATA_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type[0].toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Auto-detect inspects the file: VCF → variants, BED → peaks, gene
              matrix → expression, CpG matrix → methylation.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Project</Label>
            <Select
              disabled={isFetching && projects.length === 0}
              value={creatingProject ? NEW : projectId || undefined}
              onValueChange={onProjectChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW}>＋ Create new project…</SelectItem>
              </SelectContent>
            </Select>
            {creatingProject && (
              <InlineCreate
                placeholder="Project name"
                pending={createProjectMutation.isPending}
                onCreate={createProjectMutation.mutate}
                onCancel={() => setCreatingProject(false)}
              />
            )}
          </div>

          <div className="grid gap-2">
            <Label>Experiment</Label>
            <Select
              disabled={!projectId}
              value={creatingExperiment ? NEW : experimentId || undefined}
              onValueChange={onExperimentChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an experiment" />
              </SelectTrigger>
              <SelectContent>
                {experiments.map((experiment) => (
                  <SelectItem key={experiment.id} value={experiment.id}>
                    {experiment.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW}>＋ Create new experiment…</SelectItem>
              </SelectContent>
            </Select>
            {creatingExperiment && (
              <InlineCreate
                placeholder="Experiment name"
                pending={createExperimentMutation.isPending}
                onCreate={createExperimentMutation.mutate}
                onCancel={() => setCreatingExperiment(false)}
              />
            )}
          </div>

          <div className="grid gap-2">
            <Label>Sample</Label>
            <Select
              disabled={!experimentId}
              value={creatingSample ? NEW : sampleId || undefined}
              onValueChange={onSampleChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a sample" />
              </SelectTrigger>
              <SelectContent>
                {samples.map((sample) => (
                  <SelectItem key={sample.id} value={sample.id}>
                    {sample.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW}>＋ Create new sample…</SelectItem>
              </SelectContent>
            </Select>
            {creatingSample && (
              <InlineCreate
                placeholder="Sample name"
                pending={createSampleMutation.isPending}
                onCreate={createSampleMutation.mutate}
                onCancel={() => setCreatingSample(false)}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={uploadMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <LoadingButton
            type="submit"
            disabled={!file || !sampleId}
            loading={uploadMutation.isPending}
            onClick={onSubmit}
          >
            Upload
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InlineCreate({
  placeholder,
  pending,
  onCreate,
  onCancel,
}: {
  placeholder: string
  pending: boolean
  onCreate: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder={placeholder}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && name.trim()) onCreate(name.trim())
        }}
      />
      <LoadingButton
        size="sm"
        disabled={!name.trim()}
        loading={pending}
        onClick={() => onCreate(name.trim())}
      >
        Create
      </LoadingButton>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}

export default UploadDocument
