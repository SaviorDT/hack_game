import type { ProcessDefinitionId } from '../domain/ids.ts'
import type { JsonValue } from '../domain/JsonValue.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import type { ProcessDefinition } from '../processes/ProcessDefinition.ts'
import type { ProcessInstance } from '../processes/ProcessInstance.ts'
import type { RenderPosition, SimulationEngine } from './SimulationEngine.ts'

export interface ProcessTickContext {
  readonly state: WorldState
  readonly worldObject: WorldObject
  readonly processInstance: ProcessInstance
  readonly tickDurationMs: number
}

export interface WorldObjectProcess extends ProcessDefinition {
  readonly definitionId: ProcessDefinitionId
  tick(context: ProcessTickContext): void
}

export type BehaviorConditionEvaluator = (
  condition: JsonValue,
  worldObject: WorldObject,
  state: WorldState,
) => boolean

export const SIMULATION_TICK_MS = 1000 / 60

function evaluateAlwaysActiveCondition(condition: JsonValue): boolean {
  if (condition === true) {
    return true
  }

  if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
    return false
  }

  return (condition as Readonly<Record<string, JsonValue>>).kind === 'always'
}

function positionOf(worldObject: WorldObject): RenderPosition | undefined {
  const state = worldObject.state
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    return undefined
  }

  const { x, y } = state as Record<string, unknown>
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : undefined
}

export class TickSimulationEngine implements SimulationEngine {
  private readonly processByDefinitionId: ReadonlyMap<ProcessDefinitionId, WorldObjectProcess>
  private readonly tickDurationMs: number
  private readonly conditionEvaluator: BehaviorConditionEvaluator
  private accumulatedGameTimeMs = 0
  private readonly previousPositions = new Map<string, RenderPosition>()

  constructor(
    processes: readonly WorldObjectProcess[],
    tickDurationMs = SIMULATION_TICK_MS,
    conditionEvaluator: BehaviorConditionEvaluator = (condition) =>
      evaluateAlwaysActiveCondition(condition),
  ) {
    if (!Number.isFinite(tickDurationMs) || tickDurationMs <= 0) {
      throw new Error('Simulation tick duration must be a positive finite number.')
    }

    this.tickDurationMs = tickDurationMs
    this.conditionEvaluator = conditionEvaluator
    this.processByDefinitionId = new Map<ProcessDefinitionId, WorldObjectProcess>(
      processes.map((process) => [process.definitionId, process] as const),
    )

    if (this.processByDefinitionId.size !== processes.length) {
      throw new Error('Simulation process definition IDs must be unique.')
    }
  }

  advance(state: WorldState, gameDeltaMs: number): void {
    if (!Number.isFinite(gameDeltaMs) || gameDeltaMs <= 0 || state.outcome !== 'playing') {
      return
    }

    this.accumulatedGameTimeMs += gameDeltaMs

    while (this.accumulatedGameTimeMs >= this.tickDurationMs) {
      this.tick(state)
      this.accumulatedGameTimeMs -= this.tickDurationMs

      if (state.outcome !== 'playing') {
        this.accumulatedGameTimeMs = 0
        return
      }
    }
  }

  renderPosition(state: WorldState, objectId: string): RenderPosition | undefined {
    const worldObject = state.worldObjects.find((candidate) => candidate.id === objectId)
    const current = worldObject ? positionOf(worldObject) : undefined
    const previous = this.previousPositions.get(objectId)
    if (!current || !previous || state.outcome !== 'playing') {
      return current
    }

    const alpha = this.accumulatedGameTimeMs / this.tickDurationMs
    return {
      x: previous.x + (current.x - previous.x) * alpha,
      y: previous.y + (current.y - previous.y) * alpha,
    }
  }

  private tick(state: WorldState): void {
    for (const worldObject of state.worldObjects) {
      const position = positionOf(worldObject)
      if (position) {
        this.previousPositions.set(worldObject.id, position)
      }
    }

    state.simulationTick += 1

    for (const worldObject of state.worldObjects) {
      const activeDefinitions = new Set<ProcessDefinitionId>()

      for (const rule of worldObject.behaviorRules) {
        if (activeDefinitions.has(rule.processDefinitionId)) {
          continue
        }

        if (!this.conditionEvaluator(rule.condition, worldObject, state)) {
          continue
        }

        const process = this.processByDefinitionId.get(rule.processDefinitionId)
        if (!process) {
          throw new Error(`No simulation process registered for "${rule.processDefinitionId}".`)
        }

        activeDefinitions.add(rule.processDefinitionId)
        const processInstance = this.getOrCreateProcessInstance(state, worldObject, process)
        process.tick({
          state,
          worldObject,
          processInstance,
          tickDurationMs: this.tickDurationMs,
        })

        if (state.outcome !== 'playing') {
          return
        }
      }
    }
  }

  private getOrCreateProcessInstance(
    state: WorldState,
    worldObject: WorldObject,
    process: WorldObjectProcess,
  ): ProcessInstance {
    const existingInstance = state.processInstances.find(
      (instance) =>
        instance.ownerObjectId === worldObject.id &&
        instance.definitionId === process.definitionId,
    )

    if (existingInstance) {
      return existingInstance
    }

    const processInstance: ProcessInstance = {
      id: `${worldObject.id}:${process.definitionId}`,
      ownerObjectId: worldObject.id,
      definitionId: process.definitionId,
      runtimeState: {},
    }
    state.processInstances.push(processInstance)
    return processInstance
  }
}
