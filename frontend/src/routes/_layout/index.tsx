import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { FileText, FileUp, Sparkles } from "lucide-react"
import { Suspense } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import useAuth from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { documentsApi } from "@/services/documents"
import { formatDate } from "@/utils/format"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - OmicTerms",
      },
    ],
  }),
})

function getDocumentsQueryOptions() {
  return {
    queryFn: () => documentsApi.listDocuments(),
    queryKey: ["documents"],
  }
}

function RecentDocuments() {
  const { data: documents } = useSuspenseQuery(getDocumentsQueryOptions())
  const recent = documents.data.slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent documents</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <RouterLink to="/documents">View all</RouterLink>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FileText className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No documents yet</h3>
            <p className="text-muted-foreground">
              Upload a bill, report or email to get started
            </p>
            <Button className="mt-4" asChild>
              <RouterLink to="/documents">
                <FileUp className="mr-2" />
                Upload a document
              </RouterLink>
            </Button>
          </div>
        ) : (
          recent.map((document) => (
            <RouterLink
              key={document.id}
              to="/documents/$documentId"
              params={{ documentId: document.id }}
              className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="rounded-md bg-muted p-2">
                <FileText className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium">
                  {document.file_url.split("/").pop()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(document.uploaded_at)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  document.extraction_status === "success"
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800",
                )}
              >
                {document.extraction_status}
              </Badge>
            </RouterLink>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function Dashboard() {
  const { user: currentUser } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl truncate max-w-sm">
          Hi, {currentUser?.full_name || currentUser?.email} 👋
        </h1>
        <p className="text-muted-foreground">
          Welcome back, nice to see you again!!!
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              Your documents
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Upload bills, medical reports and emails. We will break them down
            into plain language.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              Simple explanations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Every confusing term gets explained in language anyone can
            understand.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="size-4 text-muted-foreground" />
              Ask questions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Not sure about a charge or result? Chat with your document and ask.
          </CardContent>
        </Card>
      </div>

      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-lg" />
              ))}
            </CardContent>
          </Card>
        }
      >
        <RecentDocuments />
      </Suspense>
    </div>
  )
}
