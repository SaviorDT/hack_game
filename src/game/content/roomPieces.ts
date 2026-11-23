import type { Box } from '../domain/CollisionWorld.ts'
import type { Room, RoomExit } from '../domain/Room.ts'
import { assertValidRoom } from '../domain/Room.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { RoomObjectConfig } from './room.ts'
import {
  DEFAULT_PREFABS,
  applyPrefabToObject,
} from '../domain/Prefab.ts'
import { ROOM_LAYOUT } from './roomConstants.ts'
import { createRoomObjects } from './roomWorldState.ts'

/** Building blocks for rooms beyond room: object presets and turning room definitions into Rooms. */

/** Mass for enemies that never walk: a speed of 0 gives them no braking, so only weight keeps a bump from shoving them. */
export const STANDS_FIRM = 1000

export const ROOM_BOUNDS = { left: ROOM_LAYOUT.left, top: ROOM_LAYOUT.top, right: ROOM_LAYOUT.right, bottom: ROOM_LAYOUT.bottom }
export const ROOM_ENTRY = { x: 250, y: 420 }

function createPieceFromPrefab(
  prefabId: string,
  id: string,
  x: number,
  y: number,
  extra: Partial<RoomObjectConfig> = {},
): RoomObjectConfig {
  const prefab = DEFAULT_PREFABS.find((p) => p.id === prefabId)
  const base: RoomObjectConfig = {
    id,
    name: extra.name ?? prefabId,
    role: prefab?.role ?? 'object',
    x,
    y,
    displayWidth: prefab?.displayWidth ?? 64,
    displayHeight: prefab?.displayHeight ?? 64,
  }
  return prefab ? { ...applyPrefabToObject(base, prefab), ...extra } : { ...base, ...extra }
}

// Objects look and behave like room's, so every room teaches the same things.
export const dagger = (id: string, x: number, y: number, extra: Partial<RoomObjectConfig> = {}): RoomObjectConfig =>
  createPieceFromPrefab('dagger', id, x, y, { name: 'dagger', ...extra })

export const boulder = (id: string, x: number, y: number): RoomObjectConfig =>
  createPieceFromPrefab('boulder', id, x, y, { name: 'boulder' })

export const guard = (id: string, x: number, y: number, extra: Partial<RoomObjectConfig> = {}): RoomObjectConfig =>
  createPieceFromPrefab('guard', id, x, y, { name: 'guard', ...extra })

/** A wooden crate: an Obstacle light enough to shove by walking into it, and to press a plate. */
export const crate = (id: string, x: number, y: number, name = 'crate'): RoomObjectConfig =>
  createPieceFromPrefab('crate', id, x, y, { name })

/** A pressure plate on the floor: pressed while a Character or an Obstacle stands on it. */
export const plate = (id: string, x: number, y: number, name = 'plate'): RoomObjectConfig =>
  createPieceFromPrefab('plate', id, x, y, { name })

/** An archer: stands where it is and shoots arrows at the player. */
export const archer = (id: string, x: number, y: number, extra: Partial<RoomObjectConfig> = {}): RoomObjectConfig =>
  createPieceFromPrefab('archer', id, x, y, { name: 'archer', mass: STANDS_FIRM, ...extra })

/** A Target Dummy: nothing Collides with it, but a Weapon in flight hurts it. */
export const targetDummy = (id: string, x: number, y: number, extra: Partial<RoomObjectConfig> = {}): RoomObjectConfig =>
  createPieceFromPrefab('dummy', id, x, y, { name: 'dummy', ...extra })

export interface RoomDefinition {
  readonly id: string
  /** On-screen teaching text; rooms that teach by their layout leave it out. */
  readonly hint?: string
  readonly goal: string
  objects: RoomObjectConfig[]
  readonly walls?: readonly Box[]
  /** `x`/`y` default to the standard Exit position on the right wall. */
  readonly exit: Pick<RoomExit, 'targetRoomId' | 'label' | 'requires' | 'endsGame' | 'hiddenUntilOpen'> &
    Partial<Pick<RoomExit, 'x' | 'y'>>
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
    exits: [{ ...ROOM_LAYOUT.exit, ...definition.exit }],
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
