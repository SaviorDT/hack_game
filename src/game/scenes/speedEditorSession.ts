import {
  WORLD_OBJECT_IDS,
} from '../content/room1Constants.ts'
import {
  ROOM1_OBJECTS,
  type PlayerSpeedConfig,
  type RoomObjectConfig,
} from '../content/room1.ts'
import { GAME_MV_CONFIG, type MvConfig } from '../commands/mvConstants.ts'
import { GAME_PHYSICS_CONFIG, type PhysicsConfig } from '../simulation/physicsConstants.ts'
import { createInitialWorldState } from '../content/room1WorldState.ts'
import { createRoom1CommandSubmissionService } from '../content/room1Commands.ts'
import { GameSession } from '../application/GameSession.ts'
import { InputModeController } from '../application/InputModeController.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'
import { RealtimeSimulationClock } from '../simulation/RealtimeSimulationClock.ts'
import { TickSimulationEngine } from '../simulation/TickSimulationEngine.ts'
import { PlayerMovementProcess, DaggerPickupProcess, BoulderProcess } from '../simulation/room1/Room1Processes.ts'
import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import { CombatService } from '../domain/CombatService.ts'
import { PickUpService } from '../domain/PickUpService.ts'
import { LocalStorageSaveRepository } from '../persistence/LocalStorageSaveRepository.ts'
import { JsonWorldStateCodec } from '../persistence/JsonWorldStateCodec.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { getEditorStorage } from '../application/editorStorage.ts'

export const DEFAULT_SPEED_CONFIG: PlayerSpeedConfig = {
  acceleration: 2500,
  frictionAcceleration: 3000,
  turnaroundAcceleration: 1600,
  maxSpeed: 300,
}

export { GAME_MV_CONFIG, GAME_PHYSICS_CONFIG, type MvConfig, type PhysicsConfig }

/** Everything the Speed Editor tunes for `mv` throws: the pull of `mv` and the global physics values. */
export type TuningConfig = MvConfig & PhysicsConfig

export function getTuningConfig(config?: Partial<TuningConfig>): TuningConfig {
  return {
    mv_acceleration: config?.mv_acceleration ?? GAME_MV_CONFIG.mv_acceleration,
    drag: config?.drag ?? GAME_PHYSICS_CONFIG.drag,
    mass: config?.mass ?? GAME_PHYSICS_CONFIG.mass,
    max_velocity: config?.max_velocity ?? GAME_PHYSICS_CONFIG.max_velocity,
    restitution: config?.restitution ?? GAME_PHYSICS_CONFIG.restitution,
    friction: config?.friction ?? GAME_PHYSICS_CONFIG.friction,
    min_velocity: config?.min_velocity ?? GAME_PHYSICS_CONFIG.min_velocity,
    min_collide_move_velocity: config?.min_collide_move_velocity ?? GAME_PHYSICS_CONFIG.min_collide_move_velocity,
  }
}

/** Copies a tuning config into the live global configs, so the running game uses it. */
export function applyTuningConfig(config: TuningConfig): void {
  GAME_MV_CONFIG.mv_acceleration = config.mv_acceleration
  for (const key of Object.keys(GAME_PHYSICS_CONFIG)) {
    GAME_PHYSICS_CONFIG[key] = config[key]
  }
}

export function getPlayerSpeedFromObjects(objects: RoomObjectConfig[]): PlayerSpeedConfig {
  const player = objects.find((o) => o.role === 'player' || o.id === WORLD_OBJECT_IDS.player)
  if (player && typeof player.speed === 'object' && player.speed !== null) {
    return {
      acceleration: player.speed.acceleration ?? DEFAULT_SPEED_CONFIG.acceleration,
      frictionAcceleration: player.speed.frictionAcceleration ?? DEFAULT_SPEED_CONFIG.frictionAcceleration,
      turnaroundAcceleration: player.speed.turnaroundAcceleration ?? DEFAULT_SPEED_CONFIG.turnaroundAcceleration,
      maxSpeed: player.speed.maxSpeed ?? DEFAULT_SPEED_CONFIG.maxSpeed,
    }
  }
  return { ...DEFAULT_SPEED_CONFIG }
}

export interface SpeedEditorSessionBundle {
  session: GameSession
  worldState: WorldState
}

export function createSpeedEditorSession(options?: {
  playerSpeed?: PlayerSpeedConfig
  mvConfig?: () => MvConfig
  physicsConfig?: () => PhysicsConfig
  storage?: Storage
  objects?: RoomObjectConfig[]
}): SpeedEditorSessionBundle {
  const sourceObjects = options?.objects ?? ROOM1_OBJECTS
  const worldState = createInitialWorldState(sourceObjects)

  // Disable exits so running into the door doesn't trigger room transition / congratulations
  worldState.rooms = worldState.rooms.map((room) => ({
    ...room,
    exits: [],
  }))

  // Clear behavior rules for guards so they remain static
  // landmarks and do not pursue or attack during speed tuning.
  worldState.worldObjects = worldState.worldObjects.map((obj) => {
    if (
      obj.id !== WORLD_OBJECT_IDS.player &&
      obj.id !== WORLD_OBJECT_IDS.dagger &&
      obj.id !== WORLD_OBJECT_IDS.boulder &&
      obj.metadata.role !== 'object'
    ) {
      return new BasicWorldObject(obj.id, obj.roomId, obj.metadata, [], obj.state)
    }
    return obj
  })

  const speed: PlayerSpeedConfig = options?.playerSpeed ?? getPlayerSpeedFromObjects(sourceObjects)

  // Apply speed configuration to player domain entity
  const player = worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
  if (player) {
    const state = player.state as Record<string, unknown>
    state.speed = { ...speed }
    state.maxSpeed = speed.maxSpeed
    state.acceleration = speed.acceleration
    state.frictionAcceleration = speed.frictionAcceleration
    state.turnaroundAcceleration = speed.turnaroundAcceleration
    state.vx = 0
    state.vy = 0
  }

  // Simulation engine runs PlayerMovementProcess, DaggerPickupProcess, and BoulderProcess:
  // guards will not pursue or attack, while player movement and thrown weapon/object physics execute.
  // Contacts are off so a thrown dagger does not hurt the static guards while tuning.
  const simulationEngine = new TickSimulationEngine(
    [new PlayerMovementProcess(), new DaggerPickupProcess(), new BoulderProcess()],
    undefined,
    undefined,
    { mvConfig: options?.mvConfig, physicsConfig: options?.physicsConfig, contactResolver: null },
  )
  const session = new GameSession({
    worldState,
    commandSubmission: createRoom1CommandSubmissionService(),
    simulationClock: new RealtimeSimulationClock(),
    simulationEngine,
    saveRepository: new LocalStorageSaveRepository(getEditorStorage(options?.storage), 'hack-game.editor-save'),
    worldStateCodec: new JsonWorldStateCodec(),
    inputMode: new InputModeController(INPUT_BINDINGS.movement),
    combat: new CombatService(),
    pickUpService: new PickUpService(),
    playerId: WORLD_OBJECT_IDS.player,
  })

  return { session, worldState }
}
