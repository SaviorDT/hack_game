import type { ColliderShape } from './CollisionWorld.ts'
import type { ObjectKind } from './ObjectKind.ts'
import type {
  PhysicsAttrConfig,
  PlayerSpeedConfig,
  RoomObjectConfig,
  WorldObjectRole,
} from '../content/room1.ts'

export interface PrefabDefinition extends PhysicsAttrConfig {
  id: string
  name: string
  role: WorldObjectRole
  kind?: ObjectKind
  displayWidth: number
  displayHeight: number
  scaleX: number
  scaleY: number
  colliderWidth?: number
  colliderHeight?: number
  colliderShape?: ColliderShape
  maxHealth?: number
  speed?: number | PlayerSpeedConfig
  attackDistance?: number
  attackDurationMs?: number
  holdOffsetX?: number
  holdOffsetY?: number
  passive?: boolean
  mvLimit?: number
}

export const DEFAULT_PREFABS: readonly PrefabDefinition[] = [
  {
    id: "guard",
    name: "Guard",
    role: "enemy",
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 210,
    maxHealth: 100,
    colliderWidth: 110,
    colliderHeight: 160,
    colliderShape: "box",
  },
  {
    id: "dagger",
    name: "Dagger",
    role: "weapon",
    displayWidth: 49,
    displayHeight: 49,
    scaleX: 0.68,
    scaleY: 0.68,
    attackDistance: 30,
    attackDurationMs: 200,
    holdOffsetX: 20,
    holdOffsetY: 26,
    colliderWidth: 72,
    colliderHeight: 72,
    colliderShape: "box",
  },
  {
    id: "boulder",
    name: "Boulder",
    role: "object",
    displayWidth: 154,
    displayHeight: 154,
    scaleX: 1.28,
    scaleY: 1.28,
    colliderWidth: 128,
    colliderHeight: 128,
    colliderShape: "circle",
    mass: 100,
  },
  {
    id: "crate",
    name: "Crate",
    role: "object",
    kind: "crate",
    displayWidth: 88,
    displayHeight: 88,
    scaleX: 1,
    scaleY: 1,
    colliderWidth: 80,
    colliderHeight: 80,
    colliderShape: "box",
    mass: 3,
  },
  {
    id: "plate",
    name: "Pressure Plate",
    role: "object",
    kind: "plate",
    displayWidth: 96,
    displayHeight: 96,
    scaleX: 1,
    scaleY: 1,
    colliderWidth: 80,
    colliderHeight: 80,
    colliderShape: "box",
  },
  {
    id: "archer",
    name: "Archer",
    role: "enemy",
    kind: "archer",
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 0,
    maxHealth: 30,
    colliderWidth: 110,
    colliderHeight: 160,
    colliderShape: "box",
    mass: 1000,
  },
  {
    id: "dummy",
    name: "Target Dummy",
    role: "object",
    kind: "dummy",
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    maxHealth: 1000,
    colliderWidth: 110,
    colliderHeight: 160,
    colliderShape: "box",
  },
  {
    id: "player",
    name: "Player",
    role: "player",
    displayWidth: 94,
    displayHeight: 94,
    scaleX: 0.53,
    scaleY: 0.53,
    speed: {
      acceleration: 4000,
      frictionAcceleration: 3000,
      turnaroundAcceleration: 1600,
      maxSpeed: 500,
    },
    maxHealth: 100,
    colliderWidth: 50,
    colliderHeight: 71,
    colliderShape: "box",
  },
]

/**
 * Infers the matching prefab identifier for any room object configuration.
 */
export function inferPrefabId(obj: RoomObjectConfig): string {
  if (obj.prefabId) {
    return obj.prefabId
  }
  if (obj.kind === 'crate') return 'crate'
  if (obj.kind === 'plate') return 'plate'
  if (obj.kind === 'archer') return 'archer'
  if (obj.kind === 'dummy') return 'dummy'
  if (obj.role === 'weapon') return 'dagger'
  if (obj.role === 'player' || obj.id === 'player') return 'player'
  if (
    obj.role === 'object' &&
    (obj.colliderShape === 'circle' || obj.name === 'boulder' || obj.id.startsWith('boulder'))
  ) {
    return 'boulder'
  }
  if (obj.role === 'enemy' || obj.role === 'guard') {
    return 'guard'
  }
  return obj.kind ?? obj.role
}

/**
 * Applies prefab template properties to a target object while preserving instance-specific fields
 * (id, x, y, custom display name).
 */
export function applyPrefabToObject(
  target: RoomObjectConfig,
  prefab: PrefabDefinition,
): RoomObjectConfig {
  const result: RoomObjectConfig = {
    ...target,
    role: prefab.role,
    displayWidth: prefab.displayWidth,
    displayHeight: prefab.displayHeight,
    scaleX: prefab.scaleX,
    scaleY: prefab.scaleY,
    prefabId: prefab.id,
  }

  if (prefab.kind !== undefined) {
    result.kind = prefab.kind
  }
  if (prefab.colliderWidth !== undefined) {
    result.colliderWidth = prefab.colliderWidth
  }
  if (prefab.colliderHeight !== undefined) {
    result.colliderHeight = prefab.colliderHeight
  }
  if (prefab.colliderShape !== undefined) {
    result.colliderShape = prefab.colliderShape
  }
  if (prefab.maxHealth !== undefined) {
    result.maxHealth = prefab.maxHealth
  }
  if (prefab.speed !== undefined) {
    result.speed = typeof prefab.speed === 'object' ? { ...prefab.speed } : prefab.speed
  }
  if (prefab.attackDistance !== undefined) {
    result.attackDistance = prefab.attackDistance
  }
  if (prefab.attackDurationMs !== undefined) {
    result.attackDurationMs = prefab.attackDurationMs
  }
  if (prefab.holdOffsetX !== undefined) {
    result.holdOffsetX = prefab.holdOffsetX
  }
  if (prefab.holdOffsetY !== undefined) {
    result.holdOffsetY = prefab.holdOffsetY
  }
  if (prefab.passive !== undefined) {
    result.passive = prefab.passive
  }
  if (prefab.mvLimit !== undefined) {
    result.mvLimit = prefab.mvLimit
  }

  const physicsKeys: (keyof PhysicsAttrConfig)[] = [
    'mass',
    'drag',
    'friction',
    'max_velocity',
    'restitution',
  ]
  for (const key of physicsKeys) {
    if (prefab[key] !== undefined) {
      result[key] = prefab[key]
    }
  }

  return result
}
