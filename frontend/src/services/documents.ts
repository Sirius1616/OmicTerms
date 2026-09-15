import type { Body_documents_create_document, DocumentPublic } from "@/client"
import { DocumentsService } from "@/client"
import { OpenAPI } from "@/client/core/OpenAPI"

import type {
  ConversationPublic,
  DocumentsPublic,
  ExplanationPublic,
  MessageCreate,
  MessagePublic,
} from "@/types/documents"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const mockExplanation = ""

export const documentsApi = {
  async listDocuments(): Promise<DocumentsPublic> {
    return DocumentsService.readDocuments()
  },

  async uploadDocument(
    file: File,
    sampleId: string,
    dataType: string = "auto",
  ): Promise<DocumentPublic> {
    return DocumentsService.createDocument({
      formData: {
        file,
        sample_id: sampleId,
        data_type: dataType,
      } as unknown as Body_documents_create_document,
    })
  },

  async getDocument(id: string): Promise<DocumentPublic> {
    return DocumentsService.readDoc({ id })
  },

  async updateDocument(id: string, filename: string): Promise<DocumentPublic> {
    return DocumentsService.changeFilename({ id, requestBody: { filename } })
  },

  async deleteDocument(id: string): Promise<void> {
    return DocumentsService.deleteFile({ id })
  },

  async getFileBlob(filename: string): Promise<Blob> {
    const token = localStorage.getItem("access_token")
    const response = await fetch(
      `${OpenAPI.BASE}/api/v1/uploads/${encodeURIComponent(filename)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    )
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.status}`)
    }
    return response.blob()
  },

  async getExplanation(_documentId: string): Promise<ExplanationPublic | null> {
    await delay(800)
    if (!mockExplanation) {
      return null
    }
    return {
      id: crypto.randomUUID(),
      summary_text: mockExplanation,
      generated_at: new Date().toISOString(),
    }
  },

  async getConversation(documentId: string): Promise<ConversationPublic> {
    await delay(300)
    return {
      id: crypto.randomUUID(),
      document_id: documentId,
      created_at: new Date().toISOString(),
    }
  },

  async listMessages(): Promise<MessagePublic[]> {
    await delay(300)
    return []
  },

  async sendMessage(_data: MessageCreate): Promise<MessagePublic> {
    await delay(600)
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "This is a placeholder reply. Once the document extraction is wired up, I will answer questions about your document in plain language.",
      created_at: new Date().toISOString(),
    }
  },
}
