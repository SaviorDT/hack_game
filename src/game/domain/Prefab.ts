import type { ColliderShape } from './CollisionWorld.ts'
import type {
  PhysicsAttrConfig,
  PlayerSpeedConfig,
  RoomObjectConfig,
  WorldObjectRole,
} from '../content/room1.ts'
import {
  DAGGER_SIZE,
  GAME_WEAPON_CONFIG,
} from '../content/room1Constants.ts'

export interface PrefabDefinition extends PhysicsAttrConfig {
  id: string
  name: string
  role: WorldObjectRole
  kind?: 'crate' | 'plate' | 'archer'
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
}

export const DEFAULT_PREFABS: readonly PrefabDefinition[] = [
  {
    id: 'guard',
    name: 'Guard',
    role: 'enemy',
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 210,
    maxHealth: 100,
    colliderWidth: 110,
    colliderHeight: 160,
    colliderShape: 'box',
  },
  {
    id: 'dagger',
    name: 'Dagger',
    role: 'weapon',
    displayWidth: DAGGER_SIZE.width,
    displayHeight: DAGGER_SIZE.height,
    scaleX: 1,
    scaleY: 1,
    colliderWidth: DAGGER_SIZE.width,
    colliderHeight: DAGGER_SIZE.height,
    colliderShape: 'box',
    attackDistance: GAME_WEAPON_CONFIG.attackDistance,
    attackDurationMs: GAME_WEAPON_CONFIG.attackDurationMs,
    holdOffsetX: GAME_WEAPON_CONFIG.holdOffsetX,
    holdOffsetY: GAME_WEAPON_CONFIG.holdOffsetY,
  },
  {
    id: 'boulder',
    name: 'Boulder',
    role: 'object',
    displayWidth: 154,
    displayHeight: 154,
    scaleX: 1.28,
    scaleY: 1.28,
    colliderWidth: 128,
    colliderHeight: 128,
    colliderShape: 'circle',
    mass: 100,
  },
  {
    id: 'crate',
    name: 'Crate',
    role: 'object',
    kind: 'crate',
    displayWidth: 88,
    displayHeight: 88,
    scaleX: 1,
    scaleY: 1,
    colliderWidth: 80,
    colliderHeight: 80,
    colliderShape: 'box',
    mass: 3,
  },
  {
    id: 'plate',
    name: 'Pressure Plate',
    role: 'object',
    kind: 'plate',
    displayWidth: 96,
    displayHeight: 96,
    scaleX: 1,
    scaleY: 1,
    colliderWidth: 80,
    colliderHeight: 80,
    colliderShape: 'box',
  },
  {
    id: 'archer',
    name: 'Archer',
    role: 'enemy',
    kind: 'archer',
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 0,
    maxHealth: 30,
    mass: 1000,
    colliderWidth: 110,
    colliderHeight: 160,
    colliderShape: 'box',
  },
  {
    id: 'player',
    name: 'Player',
    role: 'player',
    displayWidth: 125,
    displayHeight: 125,
    scaleX: 0.71,
    scaleY: 0.71,
    colliderWidth: 62,
    colliderHeight: 94,
    colliderShape: 'box',
    speed: {
      acceleration: 2500,
      frictionAcceleration: 3000,
      turnaroundAcceleration: 1600,
      maxSpeed: 300,
    },
    maxHealth: 100,
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
