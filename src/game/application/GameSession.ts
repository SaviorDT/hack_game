import type { CommandSubmissionService } from '../commands/CommandSubmissionService.ts'
import type { CommandResult } from '../commands/CommandResult.ts'
import type { SaveRepository } from '../persistence/SaveRepository.ts'
import type { SaveSnapshot } from '../persistence/SaveSnapshot.ts'
import type { WorldStateCodec } from '../persistence/WorldStateCodec.ts'
import type { SimulationClock } from '../simulation/SimulationClock.ts'
import type { SimulationEngine } from '../simulation/SimulationEngine.ts'
import type { WorldState } from '../domain/WorldState.ts'

export interface GameSessionDependencies {
  worldState: WorldState
  commandSubmission: CommandSubmissionService
  simulationClock: SimulationClock
  simulationEngine: SimulationEngine
  saveRepository: SaveRepository
  worldStateCodec: WorldStateCodec
}

export class GameSession {
  private readonly dependencies: GameSessionDependencies

  constructor(dependencies: GameSessionDependencies) {
    this.dependencies = dependencies
  }

  update(realDeltaMs: number): void {
    const gameDeltaMs = this.dependencies.simulationClock.toGameDelta(realDeltaMs)
    this.dependencies.simulationEngine.advance(this.dependencies.worldState, gameDeltaMs)
  }

  getWorldState(): WorldState {
    return this.dependencies.worldState
  }

  submitCommand(rawText: string): CommandResult {
    this.dependencies.worldState.commandHistory.push(rawText)
    return this.dependencies.commandSubmission.submit(rawText, this.dependencies.worldState)
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
}
