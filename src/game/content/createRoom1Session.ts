import { GameSession } from '../application/GameSession.ts'
import { InputModeController } from '../application/InputModeController.ts'
import type { MovementBindings } from '../application/InputModeController.ts'
import { CombatService } from '../domain/CombatService.ts'
import { PickUpService } from '../domain/PickUpService.ts'
import { JsonWorldStateCodec } from '../persistence/JsonWorldStateCodec.ts'
import { LocalStorageSaveRepository } from '../persistence/LocalStorageSaveRepository.ts'
import { RealtimeSimulationClock } from '../simulation/RealtimeSimulationClock.ts'
import { TickSimulationEngine } from '../simulation/TickSimulationEngine.ts'
import { ROOM1_PROCESSES } from '../simulation/room1/Room1Processes.ts'
import { createRoom1CommandSubmissionService } from './room1Commands.ts'
import { createInitialWorldState, WORLD_OBJECT_IDS } from './room1.ts'

export interface Room1SessionOptions {
  readonly movementBindings: MovementBindings
  readonly storage?: Storage
}

export function createRoom1Session(options: Room1SessionOptions): GameSession {
  return new GameSession({
    worldState: createInitialWorldState(),
    commandSubmission: createRoom1CommandSubmissionService(),
    simulationClock: new RealtimeSimulationClock(),
    simulationEngine: new TickSimulationEngine(ROOM1_PROCESSES),
    saveRepository: new LocalStorageSaveRepository(options.storage),
    worldStateCodec: new JsonWorldStateCodec(),
    inputMode: new InputModeController(options.movementBindings),
    combat: new CombatService(),
    pickUpService: new PickUpService(),
    playerId: WORLD_OBJECT_IDS.player,
  })
}
