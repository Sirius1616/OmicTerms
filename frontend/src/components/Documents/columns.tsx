import type { ColumnDef } from "@tanstack/react-table"
import { FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  DataType,
  DocumentPublic,
  ExtractionStatus,
} from "@/types/documents"
import { formatDate } from "@/utils/format"
import { DocumentActionsMenu } from "./DocumentActionsMenu"

function getFileName(fileUrl: string): string {
  return fileUrl.split("/").pop() || fileUrl
}

function getDisplayName(document: DocumentPublic): string {
  return document.filename || getFileName(document.file_url)
}

function getSamplePath(document: DocumentPublic): string {
  return [document.project_name, document.experiment_name, document.sample_name]
    .filter((part): part is string => Boolean(part))
    .join(" / ")
}

function StatusBadge({ status }: { status: ExtractionStatus }) {
  const styles: Record<ExtractionStatus, string> = {
    pending: "bg-amber-100 text-amber-800",
    success: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  }

  return (
    <Badge variant="outline" className={cn(styles[status])}>
      {status}
    </Badge>
  )
}

const DATA_TYPE_STYLES: Record<DataType, string> = {
  expression: "bg-sky-100 text-sky-800",
  methylation: "bg-violet-100 text-violet-800",
  variants: "bg-rose-100 text-rose-800",
  peaks: "bg-emerald-100 text-emerald-800",
  document: "bg-slate-100 text-slate-700",
}

function DataTypeBadge({ dataType }: { dataType?: DataType | null }) {
  if (!dataType) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        detecting…
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={cn(DATA_TYPE_STYLES[dataType])}>
      {dataType}
    </Badge>
  )
}

export const columns: ColumnDef<DocumentPublic>[] = [
  {
    accessorKey: "file_url",
    header: "Document",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-muted p-2">
          <FileText className="size-4 text-muted-foreground" />
        </div>
        <span className="font-medium max-w-xs truncate">
          {getDisplayName(row.original)}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "sample_id",
    header: "Sample",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground break-words">
        {getSamplePath(row.original) || "—"}
      </span>
    ),
  },
  {
    accessorKey: "extraction_status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.extraction_status} />,
  },
  {
    accessorKey: "data_type",
    header: "Type",
    cell: ({ row }) => <DataTypeBadge dataType={row.original.data_type} />,
  },
  {
    accessorKey: "uploaded_at",
    header: "Uploaded",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.original.uploaded_at)}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" asChild>
          <a href={`/documents/${row.original.id}`}>Open</a>
        </Button>
        <DocumentActionsMenu document={row.original} />
      </div>
    ),
  },
]
