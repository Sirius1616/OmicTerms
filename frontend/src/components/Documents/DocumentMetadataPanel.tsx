import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Database, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { documentsApi } from "@/services/documents"
import {
  COORDINATE_SYSTEMS,
  type CoordinateSystem,
  type DatasetMetadata,
  type DatasetMetadataUpdate,
} from "@/types/documents"
import { handleError } from "@/utils"

interface DocumentMetadataPanelProps {
  documentId: string
}

const EMPTY_FORM: DatasetMetadataUpdate = {
  genome_assembly: "",
  coordinate_system: "unknown",
  source_tool: "",
  source_tool_version: "",
  reference_database: "",
}

function toForm(metadata: DatasetMetadata | null): DatasetMetadataUpdate {
  if (!metadata) return { ...EMPTY_FORM }
  return {
    genome_assembly: metadata.genome_assembly ?? "",
    coordinate_system: metadata.coordinate_system,
    source_tool: metadata.source_tool ?? "",
    source_tool_version: metadata.source_tool_version ?? "",
    reference_database: metadata.reference_database ?? "",
  }
}

function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

const DocumentMetadataPanel = ({ documentId }: DocumentMetadataPanelProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [form, setForm] = useState<DatasetMetadataUpdate>({ ...EMPTY_FORM })

  const { data, isLoading } = useQuery({
    queryKey: ["document-metadata", documentId],
    queryFn: () => documentsApi.getMetadata(documentId),
  })

  useEffect(() => {
    if (!isLoading) {
      setForm(toForm(data ?? null))
    }
  }, [data, isLoading])

  const mutation = useMutation({
    mutationFn: (values: DatasetMetadataUpdate) =>
      documentsApi.updateMetadata(documentId, values),
    onSuccess: (saved) => {
      queryClient.setQueryData(["document-metadata", documentId], saved)
      queryClient.invalidateQueries({ queryKey: ["document", documentId] })
      showSuccessToast("Dataset metadata saved")
    },
    onError: handleError.bind(showErrorToast),
  })

  const update = (patch: DatasetMetadataUpdate) =>
    setForm((current) => ({ ...current, ...patch }))

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    mutation.mutate({
      ...form,
      genome_assembly: form.genome_assembly?.trim() || null,
      source_tool: form.source_tool?.trim() || null,
      source_tool_version: form.source_tool_version?.trim() || null,
      reference_database: form.reference_database?.trim() || null,
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" />
          <CardTitle>Dataset metadata</CardTitle>
        </div>
        <CardDescription>
          Declared context used for compatibility and provenance checks. Missing
          fields make dependent validation checks skip instead of guessing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="genome-assembly">Genome assembly</Label>
              <Input
                id="genome-assembly"
                value={form.genome_assembly ?? ""}
                onChange={(event) =>
                  update({ genome_assembly: event.target.value })
                }
                placeholder="e.g. GRCh38"
                maxLength={64}
                aria-describedby="genome-assembly-help"
              />
              <HelpText>
                <span id="genome-assembly-help">
                  Reference build declared by the data producer. Leave blank if
                  unknown; it will not be inferred.
                </span>
              </HelpText>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="coordinate-system">Coordinate system</Label>
              <Select
                value={form.coordinate_system ?? "unknown"}
                onValueChange={(value) =>
                  update({ coordinate_system: value as CoordinateSystem })
                }
              >
                <SelectTrigger id="coordinate-system" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COORDINATE_SYSTEMS.map((system) => (
                    <SelectItem key={system} value={system}>
                      {system}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <HelpText>
                BED is normally 0-based, while VCF POS is 1-based. Declare what
                the file itself uses.
              </HelpText>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="source-tool">Source tool</Label>
              <Input
                id="source-tool"
                value={form.source_tool ?? ""}
                onChange={(event) =>
                  update({ source_tool: event.target.value })
                }
                placeholder="e.g. MethMotif"
                maxLength={128}
              />
              <HelpText>
                Name of the tool or pipeline that produced this file.
              </HelpText>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="source-tool-version">Tool version</Label>
              <Input
                id="source-tool-version"
                value={form.source_tool_version ?? ""}
                onChange={(event) =>
                  update({ source_tool_version: event.target.value })
                }
                placeholder="e.g. 2.1.0"
                maxLength={64}
              />
              <HelpText>
                Version string exactly as reported by the producing tool.
              </HelpText>
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="reference-database">Reference database</Label>
              <Input
                id="reference-database"
                value={form.reference_database ?? ""}
                onChange={(event) =>
                  update({ reference_database: event.target.value })
                }
                placeholder="e.g. GENCODE v44"
                maxLength={128}
              />
              <HelpText>
                Annotation or reference release used for identifiers and
                coordinates.
              </HelpText>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {data?.recorded_at
                ? `Last saved ${new Date(data.recorded_at).toLocaleString()}`
                : "Not yet saved"}
            </p>
            <Button type="submit" disabled={mutation.isPending || isLoading}>
              {mutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Save metadata
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default DocumentMetadataPanel
