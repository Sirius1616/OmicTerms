import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { DocumentPublic } from "@/types/documents"
import DeleteDocument from "./DeleteDocument"
import RenameDocument from "./RenameDocument"

interface DocumentActionsMenuProps {
  document: DocumentPublic
}

export const DocumentActionsMenu = ({ document }: DocumentActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <RenameDocument document={document} onSuccess={() => setOpen(false)} />
        <DeleteDocument document={document} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
