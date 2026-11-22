import type { MvConfig } from '../commands/mvConstants.ts'
import type { ProcessDefinitionId } from '../domain/ids.ts'
import type { JsonValue } from '../domain/JsonValue.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import type { ProcessDefinition } from '../processes/ProcessDefinition.ts'
import type { ProcessInstance } from '../processes/ProcessInstance.ts'
import { ContactResolver } from './ContactResolver.ts'
import { MvDrive } from './MvDrive.ts'
import type { PhysicsConfig } from './physicsConstants.ts'
import { SIMULATION_TICK_MS } from './tickConstants.ts'
import { PhysicsWorld } from './PhysicsWorld.ts'
import type { RenderPosition, SimulationEngine } from './SimulationEngine.ts'

export interface ProcessTickContext {
  readonly state: WorldState
  readonly worldObject: WorldObject
  readonly processInstance: ProcessInstance
  readonly tickDurationMs: number
}

export interface WorldObjectProcess extends ProcessDefinition {
  readonly definitionId: ProcessDefinitionId
  /** Before the physics step: decides what the object does and applies its Forces. */
  tick(context: ProcessTickContext): void
  /** After the physics step, with the positions of the tick: what depends on where bodies ended up. */
  afterPhysics?(context: ProcessTickContext): void
}

export type BehaviorConditionEvaluator = (
  condition: JsonValue,
  worldObject: WorldObject,
  state: WorldState,
) => boolean

export interface TickSimulationEngineOptions {
  /** Global `mv` parameters, read each tick so live edits take effect. */
  readonly mvConfig?: () => MvConfig
  /** Global physics parameters, read each tick so live edits take effect. */
  readonly physicsConfig?: () => PhysicsConfig
  /** Resolves contacts between Thrown objects and others; `null` turns contacts off. */
  readonly contactResolver?: ContactResolver | null
}

export { SIMULATION_TICK_MS }

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

/** Distance between two ticks beyond which a body is drawn at its new position without interpolating. */
const TELEPORT_DISTANCE = 300

export class TickSimulationEngine implements SimulationEngine {
  private readonly processByDefinitionId: ReadonlyMap<ProcessDefinitionId, WorldObjectProcess>
  private readonly tickDurationMs: number
  private readonly conditionEvaluator: BehaviorConditionEvaluator
  private readonly mvDrive: MvDrive
  private readonly physics: PhysicsWorld
  private readonly contactResolver: ContactResolver | null
  private accumulatedGameTimeMs = 0
  private readonly previousPositions = new Map<string, RenderPosition>()

  constructor(
    processes: readonly WorldObjectProcess[],
    tickDurationMs = SIMULATION_TICK_MS,
    conditionEvaluator: BehaviorConditionEvaluator = (condition) =>
      evaluateAlwaysActiveCondition(condition),
    options: TickSimulationEngineOptions = {},
  ) {
    if (!Number.isFinite(tickDurationMs) || tickDurationMs <= 0) {
      throw new Error('Simulation tick duration must be a positive finite number.')
    }

    this.tickDurationMs = tickDurationMs
    this.conditionEvaluator = conditionEvaluator
    this.physics = new PhysicsWorld(options.physicsConfig)
    this.mvDrive = new MvDrive(options.mvConfig, options.physicsConfig)
    this.mvDrive.attach(this.physics)
    this.contactResolver =
      options.contactResolver === undefined ? new ContactResolver() : options.contactResolver
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
    // A jump no body can make in one tick (entering another room) is drawn at once, not slid across the screen.
    if (Math.hypot(current.x - previous.x, current.y - previous.y) > TELEPORT_DISTANCE) {
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

    // Processes decide and apply Forces, then the physics step moves every body. What depends on the
    // new positions runs afterwards; contacts see the speed the bodies moved with.
    if (!this.runProcesses(state, 'tick')) {
      return
    }
    this.mvDrive.drive(state, this.tickDurationMs)
    this.physics.step(state, this.tickDurationMs)
    if (!this.runProcesses(state, 'afterPhysics')) {
      return
    }
    this.contactResolver?.resolve(state)
    this.mvDrive.settle(state)
  }

  /** Runs one phase of the active processes of every object; false once the game is no longer being played. */
  private runProcesses(state: WorldState, phase: 'tick' | 'afterPhysics'): boolean {
    if (state.outcome !== 'playing') {
      return false
    }

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
        const context = {
          state,
          worldObject,
          processInstance,
          tickDurationMs: this.tickDurationMs,
        }
        if (phase === 'tick') {
          process.tick(context)
        } else {
          process.afterPhysics?.(context)
        }

        if (state.outcome !== 'playing') {
          return false
        }
      }
    }
    return true
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
