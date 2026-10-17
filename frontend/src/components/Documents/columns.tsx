import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { FileText } from "lucide-react"

import {
  DataTypeBadge,
  ExtractionStatusBadge,
} from "@/components/Common/DataTypeBadge"
import { Button } from "@/components/ui/button"
import type { DocumentPublic } from "@/types/documents"
import { fileNameFromUrl, formatDate } from "@/utils/format"
import { DocumentActionsMenu } from "./DocumentActionsMenu"

function getDisplayName(document: DocumentPublic): string {
  return document.filename || fileNameFromUrl(document.file_url)
}

function getSamplePath(document: DocumentPublic): string {
  return [document.project_name, document.experiment_name, document.sample_name]
    .filter((part): part is string => Boolean(part))
    .join(" / ")
}

export const columns: ColumnDef<DocumentPublic>[] = [
  {
    accessorKey: "file_url",
    header: "File",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-muted p-2">
          <FileText className="size-4 text-muted-foreground" />
        </div>
        <span className="max-w-xs truncate font-medium">
          {getDisplayName(row.original)}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "sample_id",
    header: "Sample",
    cell: ({ row }) => (
      <span className="text-sm break-words text-muted-foreground">
        {getSamplePath(row.original) || "—"}
      </span>
    ),
  },
  {
    accessorKey: "extraction_status",
    header: "Status",
    cell: ({ row }) => (
      <ExtractionStatusBadge status={row.original.extraction_status} />
    ),
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
          <Link
            to="/documents/$documentId"
            params={{ documentId: row.original.id }}
          >
            Open
          </Link>
        </Button>
        <DocumentActionsMenu document={row.original} />
      </div>
    ),
  },
]
