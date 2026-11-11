import type { Box } from '../domain/CollisionWorld.ts'
import type { Room, RoomExit } from '../domain/Room.ts'
import { assertValidRoom } from '../domain/Room.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { RoomObjectConfig } from './room1.ts'
import { ROOM_LAYOUT } from './room1Constants.ts'
import { createRoomObjects } from './room1WorldState.ts'

/** Building blocks for rooms beyond room1: object presets and turning room definitions into Rooms. */

/** Mass for enemies that never walk: a speed of 0 gives them no braking, so only weight keeps a bump from shoving them. */
export const STANDS_FIRM = 1000

export const ROOM_BOUNDS = { left: ROOM_LAYOUT.left, top: ROOM_LAYOUT.top, right: ROOM_LAYOUT.right, bottom: ROOM_LAYOUT.bottom }
export const ROOM_ENTRY = { x: 250, y: 420 }

// Objects look and behave like room1's, so every room teaches the same things.
export const dagger = (id: string, x: number, y: number): RoomObjectConfig => ({
  id,
  name: 'dagger',
  role: 'weapon',
  x,
  y,
  displayWidth: 72,
  displayHeight: 72,
  scaleX: 1,
  scaleY: 1,
  attackDistance: 30,
  attackDurationMs: 200,
  holdOffsetX: 20,
  holdOffsetY: 26,
})

export const boulder = (id: string, x: number, y: number): RoomObjectConfig => ({
  id,
  name: 'boulder',
  role: 'object',
  x,
  y,
  displayWidth: 154,
  displayHeight: 154,
  scaleX: 1.28,
  scaleY: 1.28,
  colliderWidth: 128,
  colliderHeight: 128,
  colliderShape: 'circle',
  mass: 100,
})

export const guard = (id: string, x: number, y: number, extra: Partial<RoomObjectConfig> = {}): RoomObjectConfig => ({
  id,
  name: 'guard',
  role: 'enemy',
  x,
  y,
  displayWidth: 176,
  displayHeight: 176,
  scaleX: 1,
  scaleY: 1,
  speed: 210,
  maxHealth: 100,
  colliderWidth: 110,
  colliderHeight: 160,
  ...extra,
})

/** A wooden crate: an Obstacle light enough to shove by walking into it, and to press a plate. */
export const crate = (id: string, x: number, y: number, name = 'crate'): RoomObjectConfig => ({
  id,
  name,
  role: 'object',
  kind: 'crate',
  x,
  y,
  displayWidth: 88,
  displayHeight: 88,
  scaleX: 1,
  scaleY: 1,
  colliderWidth: 80,
  colliderHeight: 80,
  mass: 3,
})

/** A pressure plate on the floor: pressed while a Character or an Obstacle stands on it. */
export const plate = (id: string, x: number, y: number, name = 'plate'): RoomObjectConfig => ({
  id,
  name,
  role: 'object',
  kind: 'plate',
  x,
  y,
  displayWidth: 96,
  displayHeight: 96,
  scaleX: 1,
  scaleY: 1,
  colliderWidth: 80,
  colliderHeight: 80,
})

/** An archer: stands where it is and shoots arrows at the player. */
export const archer = (id: string, x: number, y: number, extra: Partial<RoomObjectConfig> = {}): RoomObjectConfig =>
  guard(id, x, y, { name: 'archer', kind: 'archer', speed: 0, maxHealth: 30, mass: STANDS_FIRM, ...extra })

export interface RoomDefinition {
  readonly id: string
  /** On-screen teaching text; rooms that teach by their layout leave it out. */
  readonly hint?: string
  readonly goal: string
  objects: RoomObjectConfig[]
  readonly walls?: readonly Box[]
  readonly exit: Pick<RoomExit, 'targetRoomId' | 'label' | 'requires'>
}

/** Turns room definitions into Rooms and their World Objects; `player` (if given) starts in the first room. */
export function buildRooms(
  definitions: readonly RoomDefinition[],
  player?: RoomObjectConfig,
): { rooms: Room[]; worldObjects: WorldObject[] } {
  const worldObjects = definitions.flatMap((definition, index) =>
    createRoomObjects(
      index === 0 && player ? [{ ...player, ...ROOM_ENTRY }, ...definition.objects] : definition.objects,
      definition.id,
    ),
  )
  const rooms: Room[] = definitions.map((definition) => ({
    id: definition.id,
    objectIds: worldObjects.filter((worldObject) => worldObject.roomId === definition.id).map((worldObject) => worldObject.id),
    exits: [{ ...definition.exit, ...ROOM_LAYOUT.exit }],
    state: { name: definition.id, width: ROOM_LAYOUT.width, height: ROOM_LAYOUT.height },
    bounds: ROOM_BOUNDS,
    entry: ROOM_ENTRY,
    ...(definition.hint ? { hint: definition.hint } : {}),
    goal: definition.goal,
    restoresHealth: true,
    ...(definition.walls ? { walls: definition.walls } : {}),
  }))
  rooms.forEach(assertValidRoom)
  return { rooms, worldObjects }
}
