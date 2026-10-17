import { Link } from "@tanstack/react-router"
import { FileText, FileUp, RotateCcw } from "lucide-react"
import {
  DataTypeBadge,
  ExtractionStatusBadge,
} from "@/components/Common/DataTypeBadge"
import { EmptyState } from "@/components/Common/EmptyState"
import { Panel } from "@/components/Common/Panel"
import { Button } from "@/components/ui/button"
import type { DocumentPublic } from "@/types/documents"
import { fileNameFromUrl, formatRelativeTime } from "@/utils/format"

interface RecentFilesPanelProps {
  documents: DocumentPublic[]
  error?: boolean
  onRetry?: () => void
}

export function RecentFilesPanel({
  documents,
  error,
  onRetry,
}: RecentFilesPanelProps) {
  return (
    <Panel
      title="Recent files"
      icon={<FileText className="size-4 text-muted-foreground" />}
      bodyClassName="p-0"
      actions={
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
          <Link to="/documents">View all</Link>
        </Button>
      }
    >
      {error ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
          <span>Could not load recent files.</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="size-4" />
            Retry
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileUp}
          compact
          title="No files yet"
          body="Upload an omics file to get started. Unsupported formats are reported at upload time."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/documents">Go to Data Sources</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y">
          {documents.map((document) => (
            <li key={document.id}>
              <Link
                to="/documents/$documentId"
                params={{ documentId: document.id }}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="rounded-md bg-muted p-1.5">
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {document.filename || fileNameFromUrl(document.file_url)}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <ExtractionStatusBadge
                      status={document.extraction_status}
                    />
                    <DataTypeBadge dataType={document.data_type} />
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(document.uploaded_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
