import { GameSession } from '../application/GameSession.ts'
import { InputModeController } from '../application/InputModeController.ts'
import type { MovementBindings } from '../application/InputModeController.ts'
import { CombatService } from '../domain/CombatService.ts'
import { PickUpService } from '../domain/PickUpService.ts'
import { JsonWorldStateCodec } from '../persistence/JsonWorldStateCodec.ts'
import { LocalStorageSaveRepository } from '../persistence/LocalStorageSaveRepository.ts'
import { RealtimeSimulationClock } from '../simulation/RealtimeSimulationClock.ts'
import { TickSimulationEngine } from '../simulation/TickSimulationEngine.ts'
import { ROOM_PROCESSES } from '../simulation/room/RoomProcesses.ts'
import { createRoomCommandSubmissionService } from './roomCommands.ts'
import { createInitialWorldState } from './roomWorldState.ts'
import { WORLD_OBJECT_IDS } from './roomConstants.ts'
import type { WorldState } from '../domain/WorldState.ts'

export interface RoomSessionOptions {
  readonly movementBindings: MovementBindings
  readonly storage?: Storage
  /** The world to play; defaults to room on its own. */
  readonly worldState?: WorldState
}

export function createRoomSession(options: RoomSessionOptions): GameSession {
  return new GameSession({
    worldState: options.worldState ?? createInitialWorldState(),
    commandSubmission: createRoomCommandSubmissionService(),
    simulationClock: new RealtimeSimulationClock(),
    simulationEngine: new TickSimulationEngine(ROOM_PROCESSES),
    saveRepository: new LocalStorageSaveRepository(options.storage),
    worldStateCodec: new JsonWorldStateCodec(),
    inputMode: new InputModeController(options.movementBindings),
    combat: new CombatService(),
    pickUpService: new PickUpService(),
    playerId: WORLD_OBJECT_IDS.player,
  })
}
