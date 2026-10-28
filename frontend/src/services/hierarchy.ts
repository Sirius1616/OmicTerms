import type {
  ExperimentPublic,
  ProjectPublic,
  ProjectTreeNode,
  ProjectTreePublic,
  SamplePublic,
} from "@/client"
import { ExperimentsService, ProjectsService, SamplesService } from "@/client"

export const hierarchyApi = {
  async listProjectsTree(): Promise<ProjectTreePublic> {
    return ProjectsService.readProjectsTree()
  },

  async getProjectTree(projectId: string): Promise<ProjectTreeNode> {
    return ProjectsService.readProjectTree({ projectId })
  },

  async createProject(
    name: string,
    description?: string,
  ): Promise<ProjectPublic> {
    return ProjectsService.createProject({ requestBody: { name, description } })
  },

  async createExperiment(
    projectId: string,
    name: string,
  ): Promise<ExperimentPublic> {
    return ExperimentsService.createExperiment({
      projectId,
      requestBody: { name },
    })
  },

  async createSample(
    experimentId: string,
    name: string,
  ): Promise<SamplePublic> {
    return SamplesService.createSample({
      experimentId,
      requestBody: { name },
    })
  },

  async updateProject(
    projectId: string,
    patch: { name?: string; description?: string | null },
  ): Promise<ProjectPublic> {
    return ProjectsService.updateProject({ projectId, requestBody: patch })
  },

  async deleteProject(projectId: string): Promise<void> {
    await ProjectsService.deleteProject({ projectId })
  },

  async updateExperiment(
    experimentId: string,
    name: string,
  ): Promise<ExperimentPublic> {
    return ExperimentsService.updateExperiment({
      experimentId,
      requestBody: { name },
    })
  },

  async deleteExperiment(experimentId: string): Promise<void> {
    await ExperimentsService.deleteExperiment({ experimentId })
  },

  async updateSample(sampleId: string, name: string): Promise<SamplePublic> {
    return SamplesService.updateSample({ sampleId, requestBody: { name } })
  },

  async deleteSample(sampleId: string): Promise<void> {
    await SamplesService.deleteSample({ sampleId })
  },
}
