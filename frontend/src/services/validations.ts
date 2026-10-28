import type { ValidationRunPublic, ValidationRunsPublic } from "@/client"
import { DocumentsService, ValidationsService } from "@/client"

export const VALIDATION_CODES_DOC_URL =
  "https://github.com/Sirius1616/OmicTerms/blob/main/docs/validation-codes.md"

export function validationCodeDocUrl(code: string): string {
  return `${VALIDATION_CODES_DOC_URL}#${code.toLowerCase()}`
}

export const validationsApi = {
  async listDocumentValidations(
    documentId: string,
  ): Promise<ValidationRunsPublic> {
    return DocumentsService.listDocumentValidations({ id: documentId })
  },

  async revalidateDocument(documentId: string): Promise<ValidationRunPublic> {
    return DocumentsService.validateDocument({ id: documentId })
  },

  async listDocumentCrossValidations(
    documentId: string,
  ): Promise<ValidationRunsPublic> {
    return DocumentsService.listDocumentCrossValidations({ id: documentId })
  },

  async getValidationRun(runId: string): Promise<ValidationRunPublic> {
    return ValidationsService.getValidationRun({ runId })
  },
}
