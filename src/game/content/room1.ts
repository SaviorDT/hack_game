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
  /** A special object: a pushable `crate`, a pressure `plate`, or an `archer` enemy. */
  kind?: 'crate' | 'plate' | 'archer'
  /** The prefab template ID this object was instantiated from. */
  prefabId?: string
}

export const ROOM1_OBJECTS: RoomObjectConfig[] = [
  {
    id: "player",
    role: "player",
    x: 424,
    y: 439,
    displayWidth: 125,
    displayHeight: 125,
    scaleX: 0.71,
    scaleY: 0.71,
    speed: {
      acceleration: 2500,
      frictionAcceleration: 3000,
      turnaroundAcceleration: 1600,
      maxSpeed: 300,
    },
    maxHealth: 100,
    colliderWidth: 62,
    colliderHeight: 94,
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
    colliderShape: "circle",
    mass: 100,
  },
  {
    id: "dagger",
    role: "weapon",
    x: 614,
    y: 611,
    displayWidth: 72,
    displayHeight: 72,
    scaleX: 1,
    scaleY: 1,
    attackDistance: 30,
    attackDurationMs: 200,
    holdOffsetX: 20,
    holdOffsetY: 26,
  },
  {
    id: "guard",
    role: "enemy",
    x: 1490,
    y: 365,
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 210,
    maxHealth: 100,
    colliderWidth: 110,
    colliderHeight: 160,
  },
  {
    id: "guard2",
    role: "enemy",
    x: 1012,
    y: 410,
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 120,
    maxHealth: 100,
    colliderWidth: 82,
    colliderHeight: 163,
  },
  {
    id: "guard3",
    role: "enemy",
    x: 1160,
    y: 440,
    displayWidth: 87,
    displayHeight: 87,
    scaleX: 0.49,
    scaleY: 0.49,
    speed: 120,
    maxHealth: 100,
    colliderWidth: 54,
    colliderHeight: 78,
  },
]
