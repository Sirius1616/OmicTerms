import type {
  ExperimentPublic,
  ProjectPublic,
  ProjectTreePublic,
  SamplePublic,
} from "@/client"
import { ExperimentsService, ProjectsService, SamplesService } from "@/client"

export const hierarchyApi = {
  async listProjectsTree(): Promise<ProjectTreePublic> {
    return ProjectsService.readProjectsTree()
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
}
