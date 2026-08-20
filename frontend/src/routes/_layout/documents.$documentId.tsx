import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { ArrowLeft, FileText } from "lucide-react"
import { Suspense } from "react"

import { DocumentChat } from "@/components/Documents/DocumentChat"
import { DocumentViewer } from "@/components/Documents/DocumentViewer"
import { ExplanationPanel } from "@/components/Documents/ExplanationPanel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { documentsApi } from "@/services/documents"
import type { DocumentPublic } from "@/types/documents"

export const Route = createFileRoute("/_layout/documents/$documentId")({
  component: DocumentDetail,
  head: () => ({
    meta: [
      {
        title: "Document - OmicTerms",
      },
    ],
  }),
})

function getDocumentQueryOptions(documentId: string) {
  return {
    queryFn: () => documentsApi.getDocument(documentId),
    queryKey: ["document", documentId],
  }
}

function getFileName(fileUrl: string): string {
  return fileUrl.split("/").pop() || fileUrl
}

function getDisplayName(document: DocumentPublic): string {
  return document.filename || getFileName(document.file_url)
}

function DocumentDetailContent() {
  const { documentId } = Route.useParams()
  const { data: document } = useSuspenseQuery(
    getDocumentQueryOptions(documentId),
  )

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="text-lg font-semibold">Document not found</h3>
        <Button variant="ghost" asChild className="mt-4">
          <RouterLink to="/documents">
            <ArrowLeft className="mr-2" />
            Back to documents
          </RouterLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <RouterLink to="/documents" aria-label="Back to documents">
            <ArrowLeft className="size-4" />
          </RouterLink>
        </Button>
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-muted p-2">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {getDisplayName(document)}
            </h1>
            <p className="text-sm text-muted-foreground capitalize">
              {document.extraction_status}
            </p>
          </div>
        </div>
      </div>

      <div className={cn("grid gap-6", "lg:grid-cols-2")}>
        <div className="flex flex-col gap-6">
          <DocumentViewer documentId={document.id} fileUrl={document.file_url} />
          <ExplanationPanel documentId={document.id} />
        </div>
        <DocumentChat documentId={document.id} />
      </div>
    </div>
  )
}

function DocumentDetail() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-9 w-64" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      }
    >
      <DocumentDetailContent />
    </Suspense>
  )
}
