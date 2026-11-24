import {
  DEFAULT_PREFABS,
  applyPrefabToObject,
  inferPrefabId,
} from '../domain/Prefab.ts'

export interface PlayerSpeedConfig {
  acceleration: number
  frictionAcceleration: number
  turnaroundAcceleration: number
  maxSpeed: number
  [key: string]: number
}

/** Per-object physics values; unset fields fall back to the global defaults. */
export interface PhysicsAttrConfig {
  drag?: number
  mass?: number
  max_velocity?: number
  restitution?: number
  friction?: number
}

export type WorldObjectRole = 'player' | 'enemy' | 'weapon' | 'object' | 'guard'

export interface RoomObjectConfig extends PhysicsAttrConfig {
  id: string
  role: WorldObjectRole
  x: number
  y: number
  displayWidth: number
  displayHeight: number
  scaleX?: number
  scaleY?: number
  speed?: number | PlayerSpeedConfig
  maxHealth?: number
  attackDistance?: number
  attackDurationMs?: number
  holdOffsetX?: number
  holdOffsetY?: number
  colliderWidth?: number
  colliderHeight?: number
  /** Outline of the collider; a `circle` uses `colliderWidth` as its diameter. Defaults to `box`. */
  colliderShape?: 'box' | 'circle'
  /** Shown and typed name when it differs from `id` (ids are unique across all rooms). */
  name?: string
  /** An enemy that never moves or attacks, such as a training dummy. */
  passive?: boolean
  /** How many more times it can be the source of an `acc` Throw; `-1` is unlimited. Defaults: 1 for a Weapon, else -1. */
  mvLimit?: number
  /** Health a guard's melee hit takes from its target (Strike Damage); defaults to the guard-strike weapon's damage. */
  strikeDamage?: number
  /** A special object: a pushable `crate`, a pressure `plate`, an `archer` enemy, a Target `dummy`, or a `boss`. */
  kind?: 'crate' | 'plate' | 'archer' | 'dummy' | 'boss'
  /** The prefab template ID this object was instantiated from. */
  prefabId?: string
}

export const ROOM_OBJECTS: RoomObjectConfig[] = ([
  {
    id: "player",
    role: "player",
    x: 250,
    y: 420,
    displayWidth: 94,
    displayHeight: 94,
    scaleX: 0.53,
    scaleY: 0.53,
    speed: {
      acceleration: 4000,
      frictionAcceleration: 3000,
      turnaroundAcceleration: 10000,
      maxSpeed: 500,
    },
    maxHealth: 100,
    colliderWidth: 50,
    colliderHeight: 71,
    name: "hacker",
  },
  {
    id: "boulder",
    role: "object",
    x: 800,
    y: 280,
    displayWidth: 154,
    displayHeight: 154,
    scaleX: 1.28,
    scaleY: 1.28,
    colliderWidth: 128,
    colliderHeight: 128,
    name: "boulder",
    colliderShape: "circle",
    mass: 100,
  },
  {
    id: "dagger",
    role: "weapon",
    x: 614,
    y: 611,
    displayWidth: 49,
    displayHeight: 49,
    scaleX: 0.68,
    scaleY: 0.68,
    attackDistance: 30,
    attackDurationMs: 200,
    holdOffsetX: 20,
    holdOffsetY: 26,
    name: "dagger",
  },
  {
    id: "guard",
    role: "enemy",
    x: 1558,
    y: 422,
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 210,
    maxHealth: 200,
    strikeDamage: 40,
    colliderWidth: 110,
    colliderHeight: 160,
    name: "guard",
  },
  {
    id: "guard2",
    role: "enemy",
    x: 1277,
    y: 205,
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 210,
    maxHealth: 200,
    strikeDamage: 40,
    colliderWidth: 110,
    colliderHeight: 160,
    name: "guard2",
  },
  {
    id: "guard3",
    role: "enemy",
    x: 1221,
    y: 563,
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 210,
    maxHealth: 200,
    strikeDamage: 40,
    colliderWidth: 110,
    colliderHeight: 160,
    name: "guard3",
  },
] as RoomObjectConfig[]).map((obj) => {
  const prefab = DEFAULT_PREFABS.find((p) => p.id === inferPrefabId(obj))
  return prefab ? applyPrefabToObject(obj, prefab) : obj
})
