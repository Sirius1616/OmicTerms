import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FileSearch } from "lucide-react"
import { Suspense } from "react"

import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import { PageHeader } from "@/components/Common/PageHeader"
import { columns } from "@/components/Documents/columns"
import UploadDocument from "@/components/Documents/UploadDocument"
import PendingDocuments from "@/components/Pending/PendingDocuments"
import { documentsApi } from "@/services/documents"

type DocumentsSearch = {
  q?: string
}

function getDocumentsQueryOptions(search?: string) {
  return {
    queryFn: () => documentsApi.listDocuments({ search }),
    queryKey: ["documents", { search: search ?? null }],
  }
}

export const Route = createFileRoute("/_layout/documents/")({
  component: Documents,
  validateSearch: (search: Record<string, unknown>): DocumentsSearch => ({
    q:
      typeof search.q === "string" && search.q.length > 0
        ? search.q
        : undefined,
  }),
  head: () => ({
    meta: [
      {
        title: "Data Sources - OmicTerms",
      },
    ],
  }),
})

function DocumentsTableContent({ query }: { query?: string }) {
  const { data: documents } = useSuspenseQuery(getDocumentsQueryOptions(query))

  if (documents.data.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title={query ? "No matching data sources" : "No data sources yet"}
        body={
          query
            ? `Nothing matches “${query}”. Try a different term or clear the search.`
            : "Upload sequencing data, variant calls, or a report to get started. OmicTerms detects the format and records provenance for you."
        }
      />
    )
  }

  return <DataTable columns={columns} data={documents.data} />
}

function DocumentsTable({ query }: { query?: string }) {
  return (
    <Suspense fallback={<PendingDocuments />}>
      <DocumentsTableContent query={query} />
    </Suspense>
  )
}

function Documents() {
  const { q } = Route.useSearch()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Data Sources"
        description="Upload and manage the datasets behind your findings. Every file keeps its format, size, and extraction status."
        actions={<UploadDocument />}
      />
      <DocumentsTable query={q} />
    </div>
  )
}
