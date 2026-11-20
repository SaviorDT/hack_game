import type { CommandContext } from '../commands/CommandContext.ts'
import type { CommandSubmissionService } from '../commands/CommandSubmissionService.ts'
import type { CommandResult } from '../commands/CommandResult.ts'
import type { SaveRepository } from '../persistence/SaveRepository.ts'
import type { SaveSnapshot } from '../persistence/SaveSnapshot.ts'
import type { WorldStateCodec } from '../persistence/WorldStateCodec.ts'
import type { SimulationClock } from '../simulation/SimulationClock.ts'
import type { RenderPosition, SimulationEngine } from '../simulation/SimulationEngine.ts'
import type { CombatService } from '../domain/CombatService.ts'
import type { PickUpService } from '../domain/PickUpService.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../domain/WorldObjectState.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { startDaggerAttackAnimation } from '../content/weaponConstants.ts'
import type { InputMode, InputModeController } from './InputModeController.ts'
import {
  saveCommandSlots,
  type CommandSlot,
  type CommandSlotMap,
} from './commandSlots.ts'

const SAVE_SCHEMA_VERSION = 3

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

  enterCommandMode(): void {
    this.dependencies.inputMode.enterCommandMode()
    this.syncTimeScale()
  }

  enterMovementMode(): void {
    this.dependencies.inputMode.enterMovementMode()
    this.syncTimeScale()
  }

  keyDown(key: string): { typeable: boolean } {
    if (this.dependencies.inputMode.mode === 'movement') {
      if (this.dependencies.inputMode.isBoundTo(key, 'left') || key.toLowerCase() === 'arrowleft') {
        this.setPlayerFacing('left')
      } else if (this.dependencies.inputMode.isBoundTo(key, 'right') || key.toLowerCase() === 'arrowright') {
        this.setPlayerFacing('right')
      }
    }
    return this.dependencies.inputMode.keyDown(key)
  }

  keyUp(key: string): void {
    this.dependencies.inputMode.keyUp(key)
    if (this.dependencies.inputMode.mode === 'movement') {
      const { x } = this.dependencies.inputMode.moveVector()
      if (x < 0) {
        this.setPlayerFacing('left')
      } else if (x > 0) {
        this.setPlayerFacing('right')
      }
    }
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
      const result = this.dependencies.combat.attack(this.dependencies.worldState, this.dependencies.playerId)
      if (result.status !== 'cooling-down') {
        this.triggerEquippedDaggerAttack(this.dependencies.playerId)
      }
    }
  }

  private triggerEquippedDaggerAttack(attackerId: string): void {
    const daggerObj = this.dependencies.worldState.worldObjects.find((worldObject) => {
      const state = worldObject.state as Record<string, unknown>
      return (
        (worldObject.id === 'dagger' || worldObject.metadata.role === 'weapon') &&
        state.equippedBy === attackerId
      )
    })
    if (!daggerObj) {
      return
    }

    const state = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)
    startDaggerAttackAnimation(state)
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

  submitCommand(rawText: string, context?: CommandContext): CommandResult {
    this.dependencies.worldState.commandHistory.push(rawText)
    const result = this.dependencies.commandSubmission.submit(rawText, this.dependencies.worldState, context)
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

  getCommandSlots(): Readonly<CommandSlotMap> {
    return this.dependencies.worldState.commandSlots ?? {}
  }

  getCommandSlot(slot: CommandSlot): string | undefined {
    return this.dependencies.worldState.commandSlots?.[slot]
  }

  setCommandSlot(slot: CommandSlot, command: string): void {
    if (!this.dependencies.worldState.commandSlots) {
      this.dependencies.worldState.commandSlots = {}
    }
    this.dependencies.worldState.commandSlots[slot] = command
    saveCommandSlots(this.dependencies.worldState.commandSlots)
  }

  recordLastCommandToSlot(slot: CommandSlot): { success: boolean; command?: string } {
    const history = this.dependencies.worldState.commandHistory
    if (history.length === 0) {
      return { success: false }
    }
    const lastCommand = history[history.length - 1]
    this.setCommandSlot(slot, lastCommand)
    return { success: true, command: lastCommand }
  }

  saveCurrentState(): void {
    this.dependencies.saveRepository.save(
      {
        schemaVersion: SAVE_SCHEMA_VERSION,
        worldState: this.dependencies.worldStateCodec.serialize(this.dependencies.worldState),
      } satisfies SaveSnapshot,
    )
  }

  hasSavedState(): boolean {
    return this.readSavedSnapshot() !== null
  }

  // Replaces the current world state with the saved one in place. Returns false (leaving
  // the world untouched) when there is no usable save. Always resumes in Movement Mode.
  loadSavedState(): boolean {
    const snapshot = this.readSavedSnapshot()
    if (!snapshot) {
      return false
    }

    const restored = this.dependencies.worldStateCodec.hydrate(snapshot.worldState)
    restored.outcome = 'playing'
    Object.assign(this.dependencies.worldState, restored)
    this.dependencies.inputMode.releaseAll()
    this.enterMovementMode()
    return true
  }

  private readSavedSnapshot(): SaveSnapshot | null {
    try {
      const snapshot = this.dependencies.saveRepository.load()
      return snapshot !== null && snapshot.schemaVersion === SAVE_SCHEMA_VERSION && snapshot.worldState
        ? snapshot
        : null
    } catch {
      return null
    }
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
    const state = getMutableWorldObjectState<{ moveX: number; moveY: number; facing?: 'left' | 'right' }>(player)
    state.moveX = x
    state.moveY = y
    if (x < 0) {
      state.facing = 'left'
    } else if (x > 0) {
      state.facing = 'right'
    }
  }

  private setPlayerFacing(facing: 'left' | 'right'): void {
    const player = this.dependencies.worldState.worldObjects.find(
      (worldObject) => worldObject.id === this.dependencies.playerId,
    )
    if (!player) {
      return
    }

    const state = getMutableWorldObjectState<{ facing?: 'left' | 'right' }>(player)
    state.facing = facing
  }

  public syncTimeScale(): void {
    this.dependencies.simulationClock.setTimeScale(this.dependencies.inputMode.timeScale)
  }

  public setCommandTimeScale(scale: number): void {
    if (typeof (this.dependencies.inputMode as any).setCommandTimeScale === 'function') {
      (this.dependencies.inputMode as any).setCommandTimeScale(scale)
    }
    this.syncTimeScale()
  }

  public getCommandTimeScale(): number {
    return (this.dependencies.inputMode as any).commandTimeScale ?? this.dependencies.inputMode.timeScale
  }
}
