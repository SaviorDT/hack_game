import { GameSession } from '../application/GameSession.ts'
import { InputModeController } from '../application/InputModeController.ts'
import { WORLD_OBJECT_IDS, ROOM_LAYOUT, PROCESS_IDS } from '../content/room1Constants.ts'
import { createRoom1CommandSubmissionService } from '../content/room1Commands.ts'
import { createInitialWorldState } from '../content/room1WorldState.ts'
import { ROOM1_OBJECTS, type RoomObjectConfig } from '../content/room1.ts'
import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import { CombatService } from '../domain/CombatService.ts'
import { PickUpService } from '../domain/PickUpService.ts'
import type { WorldState } from '../domain/WorldState.ts'
import type { MutableJsonValue } from '../domain/JsonValue.ts'
import { JsonWorldStateCodec } from '../persistence/JsonWorldStateCodec.ts'
import { LocalStorageSaveRepository } from '../persistence/LocalStorageSaveRepository.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'
import { RealtimeSimulationClock } from '../simulation/RealtimeSimulationClock.ts'
import { TickSimulationEngine } from '../simulation/TickSimulationEngine.ts'
import { BoulderProcess, DaggerPickupProcess, GuardResponseProcess, PlayerMovementProcess } from '../simulation/room1/Room1Processes.ts'
import {
  BEHAVIOR_TREE_PROCESS_ID,
  BehaviorTreeProcess,
} from '../ai/behaviorTree/BehaviorTreeProcess.ts'
import {
  BOSS_CYBER_ENFORCER_TREE,
} from '../ai/behaviorTree/BehaviorTreePresets.ts'
import type {
  BehaviorTreeDef,
  BehaviorTreeStatus,
} from '../ai/behaviorTree/BehaviorTreeTypes.ts'
import { getEditorStorage } from '../application/editorStorage.ts'

export interface AiEditorSessionBundle {
  session: GameSession
  worldState: WorldState
  btProcess: BehaviorTreeProcess
  targetGuardId: string
  setTargetGuard: (guardId: string) => boolean
  setTree: (tree: BehaviorTreeDef) => void
  getTree: () => BehaviorTreeDef
  getNodeStatuses: () => ReadonlyMap<string, BehaviorTreeStatus>
  resetArena: () => void
  damageBoss: (amount: number) => void
  healBoss: (amount: number) => void
  step: (deltaMs?: number) => void
}

export function createAiEditorSession(options?: {
  tree?: BehaviorTreeDef
  bossMaxHealth?: number
  bossSpeed?: number
  storage?: Storage
  objects?: RoomObjectConfig[]
  targetGuardId?: string
}): AiEditorSessionBundle {
  const sourceObjects = options?.objects ?? ROOM1_OBJECTS
  const targetGuardId = options?.targetGuardId ?? (sourceObjects.find((o) => o.role === 'enemy' || o.role === 'guard')?.id ?? WORLD_OBJECT_IDS.guard)
  const activeTree = options?.tree ?? BOSS_CYBER_ENFORCER_TREE
  const btProcess = new BehaviorTreeProcess(activeTree)

  // Reuse room1 world state directly from ROOM1_OBJECTS
  const worldState = createInitialWorldState(sourceObjects)

  // Disable exits so running to the door does not trigger congratulations outcome
  worldState.rooms = worldState.rooms.map((room) => ({
    ...room,
    exits: [],
  }))

  // Configure target guard with BehaviorTreeProcess
  const targetGuard = worldState.worldObjects.find((o) => o.id === targetGuardId)
  if (targetGuard) {
    const gState = targetGuard.state as Record<string, unknown>
    const initialGuardCfg = sourceObjects.find((o) => o.id === targetGuardId)
    const initialMaxHp = options?.bossMaxHealth ?? (activeTree.id.includes('boss') ? 150 : (initialGuardCfg?.maxHealth ?? 100))
    gState.maxHealth = initialMaxHp
    gState.health = initialMaxHp
    if (options?.bossSpeed !== undefined) {
      gState.speed = options.bossSpeed
    }
    gState.behaviorTree = activeTree

    // Replace guard's behavior rules with BehaviorTreeProcess rule
    worldState.worldObjects = worldState.worldObjects.map((obj) => {
      if (obj.id === targetGuardId) {
        return new BasicWorldObject(
          obj.id,
          obj.roomId,
          obj.metadata,
          [{ condition: { kind: 'always' }, processDefinitionId: BEHAVIOR_TREE_PROCESS_ID }],
          obj.state,
        )
      }
      return obj
    })
  }

  // Simulation engine reuses existing processes: Player movement + Dagger pickup + Guard response + Boulder + Behavior Tree process
  const simulationEngine = new TickSimulationEngine([
    new PlayerMovementProcess(),
    new DaggerPickupProcess(),
    new GuardResponseProcess(),
    new BoulderProcess(),
    btProcess,
  ])

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

  const resetArena = () => {
    worldState.outcome = 'playing'
    worldState.processInstances = []

    // Reset player
    const playerObj = worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
    const initialPlayerCfg = sourceObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
    if (playerObj) {
      const pState = playerObj.state as Record<string, unknown>
      pState.x = initialPlayerCfg?.x ?? ROOM_LAYOUT.playerStart.x
      pState.y = initialPlayerCfg?.y ?? ROOM_LAYOUT.playerStart.y
      pState.vx = 0
      pState.vy = 0
      pState.moveX = 0
      pState.moveY = 0
      pState.facing = 'right'
      pState.health = initialPlayerCfg?.maxHealth ?? 100
      pState.alive = true
    }

    // Reset all guards
    for (const guardObj of worldState.worldObjects) {
      if (guardObj.metadata.role === 'enemy' || guardObj.metadata.role === 'guard') {
        const initialGuardCfg = sourceObjects.find((o) => o.id === guardObj.id)
        const gState = guardObj.state as Record<string, unknown>
        gState.x = initialGuardCfg?.x ?? ROOM_LAYOUT.guardStart.x
        gState.y = initialGuardCfg?.y ?? ROOM_LAYOUT.guardStart.y
        const maxHp = options?.bossMaxHealth ?? initialGuardCfg?.maxHealth ?? 100
        gState.health = maxHp
        gState.maxHealth = maxHp
        gState.alive = true
        gState.alerted = false
        gState.chasing = false
        gState.attacking = false
        gState.attackCooldownMs = 0
        if (guardObj.id === currentTargetGuardId) {
          gState.behaviorTree = btProcess.getTree()
        }
      }
    }
  }

  let currentTargetGuardId = targetGuardId

  const setTargetGuard = (newGuardId: string): boolean => {
    const newGuard = worldState.worldObjects.find((o) => o.id === newGuardId)
    if (!newGuard || (newGuard.metadata.role !== 'enemy' && newGuard.metadata.role !== 'guard')) {
      return false
    }

    const prevId = currentTargetGuardId
    worldState.worldObjects = worldState.worldObjects.map((obj) => {
      if (obj.id === prevId) {
        const oldState = obj.state as Record<string, unknown>
        delete oldState.behaviorTree
        oldState.chasing = false
        oldState.attacking = false
        oldState.alerted = false
        return new BasicWorldObject(
          obj.id,
          obj.roomId,
          obj.metadata,
          [{ condition: { kind: 'always' }, processDefinitionId: PROCESS_IDS.guard }],
          oldState as unknown as MutableJsonValue,
        )
      }
      if (obj.id === newGuardId) {
        const newState = obj.state as Record<string, unknown>
        newState.behaviorTree = btProcess.getTree()
        return new BasicWorldObject(
          obj.id,
          obj.roomId,
          obj.metadata,
          [{ condition: { kind: 'always' }, processDefinitionId: BEHAVIOR_TREE_PROCESS_ID }],
          newState as unknown as MutableJsonValue,
        )
      }
      return obj
    })

    // Remove old guard's behavior tree process instance so blackboard state does not leak
    worldState.processInstances = worldState.processInstances.filter(
      (inst) => inst.ownerObjectId !== prevId || inst.definitionId !== BEHAVIOR_TREE_PROCESS_ID,
    )

    currentTargetGuardId = newGuardId
    return true
  }

  const damageBoss = (amount: number) => {
    const guardObj = worldState.worldObjects.find((o) => o.id === currentTargetGuardId)
    if (guardObj) {
      const gState = guardObj.state as { health: number; maxHealth: number; alive: boolean }
      gState.health = Math.max(1, gState.health - amount)
    }
  }

  const healBoss = (amount: number) => {
    const guardObj = worldState.worldObjects.find((o) => o.id === currentTargetGuardId)
    if (guardObj) {
      const gState = guardObj.state as { health: number; maxHealth: number; alive: boolean }
      gState.health = Math.min(gState.maxHealth, gState.health + amount)
    }
  }

  const step = (deltaMs = 20) => {
    worldState.outcome = 'playing'
    session.update(deltaMs)
  }

  return {
    session,
    worldState,
    btProcess,
    get targetGuardId() {
      return currentTargetGuardId
    },
    setTargetGuard,
    setTree: (tree: BehaviorTreeDef) => {
      btProcess.setTree(tree)
      const guardObj = worldState.worldObjects.find((o) => o.id === currentTargetGuardId)
      if (guardObj) {
        ;(guardObj.state as Record<string, unknown>).behaviorTree = tree
      }
    },
    getTree: () => btProcess.getTree(),
    getNodeStatuses: () => btProcess.getNodeStatuses(),
    resetArena,
    damageBoss,
    healBoss,
    step,
  }
}
