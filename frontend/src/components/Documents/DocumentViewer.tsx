import { useQuery } from "@tanstack/react-query"
import { Download, FileText } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { documentsApi } from "@/services/documents"

interface DocumentViewerProps {
  documentId: string
  fileUrl: string
}

function getFileName(fileUrl: string): string {
  return fileUrl.split("/").pop() || fileUrl
}

export function DocumentViewer({ documentId, fileUrl }: DocumentViewerProps) {
  const filename = getFileName(fileUrl)
  const extension = filename.split(".").pop()?.toLowerCase() ?? ""
  const canPreview = ["pdf", "txt"].includes(extension)

  const { data: objectUrl, isPending } = useQuery({
    queryKey: ["document-file", documentId],
    queryFn: async () => {
      const blob = await documentsApi.getFileBlob(filename)
      return URL.createObjectURL(blob)
    },
  })

  useEffect(() => {
    if (!objectUrl) return
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          Document
        </CardTitle>
        {objectUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={objectUrl} download={filename}>
              <Download className="mr-2" />
              Download
            </a>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Loading document...
          </div>
        ) : !objectUrl ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-lg font-semibold">Could not load document</h3>
            <p className="text-muted-foreground max-w-sm">
              The file could not be retrieved from the server.
            </p>
          </div>
        ) : canPreview ? (
          <iframe
            src={objectUrl}
            className="h-[600px] w-full rounded-lg border bg-muted/30"
            title={filename}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="size-8 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Preview not available</h3>
            <p className="text-muted-foreground max-w-sm">
              {filename} cannot be previewed in the browser. Use the download
              button to view it.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
