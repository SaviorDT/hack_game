import type { ProcessDefinitionId } from '../domain/ids.ts'

export interface ProcessDefinition {
  readonly id: ProcessDefinitionId
  readonly definitionId?: ProcessDefinitionId
}
