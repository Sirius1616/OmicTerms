import { AxiosError } from "axios"
import type { Body_documents_create_document, DocumentPublic } from "@/client"
import { DocumentsService } from "@/client"
import { OpenAPI } from "@/client/core/OpenAPI"

import type {
  ConversationPublic,
  DatasetMetadata,
  DatasetMetadataUpdate,
  DocumentsPublic,
  ExplanationPublic,
  MessageCreate,
  MessagePublic,
} from "@/types/documents"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const mockExplanation = ""

export const documentsApi = {
  async listDocuments(params?: {
    search?: string
    limit?: number
  }): Promise<DocumentsPublic> {
    return DocumentsService.readDocuments({
      search: params?.search,
      limit: params?.limit,
    })
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

  async getMetadata(id: string): Promise<DatasetMetadata | null> {
    try {
      return (await DocumentsService.getDocumentMetadata({
        id,
      })) as DatasetMetadata
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  async updateMetadata(
    id: string,
    metadata: DatasetMetadataUpdate,
  ): Promise<DatasetMetadata> {
    return (await DocumentsService.putDocumentMetadata({
      id,
      requestBody: metadata,
    })) as DatasetMetadata
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
