import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FileSearch } from "lucide-react"
import { Suspense } from "react"

import { DataTable } from "@/components/Common/DataTable"
import { columns } from "@/components/Documents/columns"
import UploadDocument from "@/components/Documents/UploadDocument"
import PendingDocuments from "@/components/Pending/PendingDocuments"
import { documentsApi } from "@/services/documents"

function getDocumentsQueryOptions() {
  return {
    queryFn: () => documentsApi.listDocuments(),
    queryKey: ["documents"],
  }
}

export const Route = createFileRoute("/_layout/documents")({
  component: Documents,
  head: () => ({
    meta: [
      {
        title: "Documents - OmicTerms",
      },
    ],
  }),
})

function DocumentsTableContent() {
  const { data: documents } = useSuspenseQuery(getDocumentsQueryOptions())

  if (documents.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FileSearch className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No documents yet</h3>
        <p className="text-muted-foreground">
          Upload a bill, report or email and we will explain it for you
        </p>
      </div>
    )
  }

  return <DataTable columns={columns} data={documents.data} />
}

function DocumentsTable() {
  return (
    <Suspense fallback={<PendingDocuments />}>
      <DocumentsTableContent />
    </Suspense>
  )
}

function Documents() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Upload your bills, reports and emails to get them explained
          </p>
        </div>
        <UploadDocument />
      </div>
      <DocumentsTable />
    </div>
  )
}
