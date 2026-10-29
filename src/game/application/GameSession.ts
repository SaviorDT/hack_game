import type { CommandSubmissionService } from '../commands/CommandSubmissionService.ts'
import type { CommandResult } from '../commands/CommandResult.ts'
import type { SaveRepository } from '../persistence/SaveRepository.ts'
import type { SaveSnapshot } from '../persistence/SaveSnapshot.ts'
import type { WorldStateCodec } from '../persistence/WorldStateCodec.ts'
import type { SimulationClock } from '../simulation/SimulationClock.ts'
import type { RenderPosition, SimulationEngine } from '../simulation/SimulationEngine.ts'
import type { CombatService } from '../domain/CombatService.ts'
import type { PickUpService } from '../domain/PickUpService.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import type { WorldState } from '../domain/WorldState.ts'
import type { InputMode, InputModeController } from './InputModeController.ts'

export interface GameSessionDependencies {
  worldState: WorldState
  commandSubmission: CommandSubmissionService
  simulationClock: SimulationClock
  simulationEngine: SimulationEngine
  saveRepository: SaveRepository
  worldStateCodec: WorldStateCodec
  inputMode: InputModeController
  combat: CombatService
  pickUpService: PickUpService
  playerId: string
}

export class GameSession {
  private readonly dependencies: GameSessionDependencies

  constructor(dependencies: GameSessionDependencies) {
    this.dependencies = dependencies
  }

  get inputMode(): InputMode {
    return this.dependencies.inputMode.mode
  }

  toggleInputMode(): void {
    this.dependencies.inputMode.toggle()
    this.syncTimeScale()
  }

  keyDown(key: string): { typeable: boolean } {
    return this.dependencies.inputMode.keyDown(key)
  }

  keyUp(key: string): void {
    this.dependencies.inputMode.keyUp(key)
  }

  releaseAllKeys(): void {
    this.dependencies.inputMode.releaseAll()
  }

  pickUp(): void {
    if (this.canAct()) {
      this.dependencies.pickUpService.pickUp(this.dependencies.worldState, this.dependencies.playerId)
    }
  }

  attack(): void {
    if (this.canAct()) {
      this.dependencies.combat.attack(this.dependencies.worldState, this.dependencies.playerId)
    }
  }

  update(realDeltaMs: number): void {
    this.applyMoveIntent()
    const gameDeltaMs = this.dependencies.simulationClock.toGameDelta(realDeltaMs)
    this.dependencies.simulationEngine.advance(this.dependencies.worldState, gameDeltaMs)
  }

  getRenderPosition(objectId: string): RenderPosition | undefined {
    return this.dependencies.simulationEngine.renderPosition(this.dependencies.worldState, objectId)
  }

  getWorldState(): WorldState {
    return this.dependencies.worldState
  }

  submitCommand(rawText: string): CommandResult {
    this.dependencies.worldState.commandHistory.push(rawText)
    const result = this.dependencies.commandSubmission.submit(rawText, this.dependencies.worldState)
    this.dependencies.inputMode.finishCommand(result.inputAfter)
    this.syncTimeScale()
    return result
  }

  getCommandCompletionCandidates(rawText: string, cursorIndex: number): readonly string[] {
    return this.dependencies.commandSubmission.getCompletionCandidates(
      rawText,
      cursorIndex,
      this.dependencies.worldState,
    )
  }

  saveCurrentState(): void {
    this.dependencies.saveRepository.save(
      {
        schemaVersion: 1,
        worldState: this.dependencies.worldStateCodec.serialize(this.dependencies.worldState),
      } satisfies SaveSnapshot,
    )
  }

  private canAct(): boolean {
    return this.dependencies.inputMode.mode === 'movement' && this.dependencies.worldState.outcome === 'playing'
  }

  private applyMoveIntent(): void {
    const player = this.dependencies.worldState.worldObjects.find(
      (worldObject) => worldObject.id === this.dependencies.playerId,
    )
    if (!player) {
      return
    }

    const { x, y } = this.dependencies.inputMode.moveVector()
    const state = getMutableWorldObjectState<{ moveX: number; moveY: number }>(player)
    state.moveX = x
    state.moveY = y
  }

  private syncTimeScale(): void {
    this.dependencies.simulationClock.setTimeScale(this.dependencies.inputMode.timeScale)
  }
}
