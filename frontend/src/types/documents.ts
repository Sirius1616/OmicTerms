export type ExtractionStatus = "pending" | "success" | "failed"

export const DATA_TYPES = [
  "expression",
  "methylation",
  "variants",
  "peaks",
  "document",
] as const

export type DataType = (typeof DATA_TYPES)[number]

export type MessageRole = "user" | "assistant"

export type DocumentPublic = {
  file_url: string
  id: string
  filename?: string | null
  sample_id: string
  uploaded_at: string
  extraction_status: ExtractionStatus
  data_type?: DataType | null
  sample_name?: string | null
  experiment_name?: string | null
  project_name?: string | null
}

export type DocumentsPublic = {
  data: DocumentPublic[]
  count: number
}

export type DocumentCreate = {
  file_url: string
}

export type ExplanationPublic = {
  id: string
  summary_text: string
  generated_at: string
}

export type ConversationPublic = {
  id: string
  document_id: string
  created_at: string
}

export type MessagePublic = {
  id: string
  role: MessageRole
  content: string
  created_at: string
}

export type MessageCreate = {
  content: string
}

export const COORDINATE_SYSTEMS = ["0-based", "1-based", "unknown"] as const

export type CoordinateSystem = (typeof COORDINATE_SYSTEMS)[number]

export type DatasetMetadata = {
  id: string
  document_id: string
  genome_assembly?: string | null
  coordinate_system: CoordinateSystem
  source_tool?: string | null
  source_tool_version?: string | null
  reference_database?: string | null
  declared_by?: string | null
  recorded_at: string
}

export type DatasetMetadataUpdate = {
  genome_assembly?: string | null
  coordinate_system?: CoordinateSystem | null
  source_tool?: string | null
  source_tool_version?: string | null
  reference_database?: string | null
}
