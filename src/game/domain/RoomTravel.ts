import { ShapeCollisionWorld, boxFromState, type Box } from './CollisionWorld.ts'
import type { ExitRequirement, Room, RoomExit } from './Room.ts'
import { colliderTagsOf } from './ColliderTag.ts'
import { isPlatePressed } from './PressurePlate.ts'
import type { WorldObject } from './WorldObject.ts'
import type { WorldState } from './WorldState.ts'

/** The area in front of an Exit that the Player Character walks into to go through it. */
export const EXIT_ZONE_SIZE = { width: 60, height: 160 } as const

const collision = new ShapeCollisionWorld()

function stateOf<T>(worldObject: WorldObject): T {
  return worldObject.state as unknown as T
}

interface TravellerState {
  x: number
  y: number
  width: number
  height: number
  vx?: number
  vy?: number
  forceX?: number
  forceY?: number
  thrown?: unknown
  weaponId?: string | null
  health?: number
  maxHealth?: number
  alive?: boolean
  [key: string]: unknown
}

export function exitZoneOf(exit: RoomExit): Box {
  return { x: exit.x, y: exit.y, ...EXIT_ZONE_SIZE }
}

export function currentRoomOf(state: WorldState): Room | undefined {
  return state.rooms.find((room) => room.id === state.currentRoomId)
}

function objectsIn(state: WorldState, room: Room): WorldObject[] {
  return state.worldObjects.filter((worldObject) => worldObject.roomId === room.id && room.objectIds.includes(worldObject.id))
}

function isRequirementMet(state: WorldState, room: Room, requirement: ExitRequirement): boolean {
  const inRoom = objectsIn(state, room)
  switch (requirement.kind) {
    case 'defeat':
      return requirement.objectIds.every((id) => {
        const target = inRoom.find((worldObject) => worldObject.id === id)
        return !target || (target.state as { alive?: unknown }).alive === false
      })
    case 'discover-all':
      return inRoom.every(
        (worldObject) =>
          worldObject.metadata.discoverable !== true || (worldObject.state as { discovered?: unknown }).discovered === true,
      )
    case 'pressed':
      return requirement.plateIds.every((id) => {
        const plate = inRoom.find((worldObject) => worldObject.id === id)
        return plate !== undefined && isPlatePressed(state, plate)
      })
  }
}

/** Whether the Exit's requirements (if any) are all met in its room right now. */
export function isExitOpen(state: WorldState, room: Room, exit: RoomExit): boolean {
  const requirements = exit.requires === undefined ? [] : Array.isArray(exit.requires) ? exit.requires : [exit.requires]
  return (requirements as readonly ExitRequirement[]).every((requirement) => isRequirementMet(state, room, requirement))
}

/** Whether an Obstacle (a crate, a boulder) stands in the Exit's doorway, so nobody can get through it. */
export function isExitBlocked(state: WorldState, room: Room, exit: RoomExit): boolean {
  const zone = exitZoneOf(exit)
  return objectsIn(state, room).some((worldObject) => {
    const objectState = worldObject.state as { x?: unknown; y?: unknown; width?: unknown; height?: unknown; alive?: unknown }
    return (
      colliderTagsOf(worldObject).some((tag) => tag.class === 'obstacle') &&
      objectState.alive !== false &&
      typeof objectState.x === 'number' &&
      collision.overlaps(boxFromState(objectState as { x: number; y: number; width: number; height: number }), zone)
    )
  })
}

/** Why the Exit is locked, or `null` if it is open. */
export function exitLockReason(state: WorldState, room: Room, exit: RoomExit): string | null {
  if (isExitOpen(state, room, exit)) {
    return null
  }
  return `The way to ${exit.label} is locked. ${room.goal ?? 'Finish this room first.'}`
}

function playerOf(state: WorldState, playerId: string): WorldObject | undefined {
  return state.worldObjects.find((worldObject) => worldObject.id === playerId)
}

/** Whether the Player Character stands within `reach` of the Exit's zone. */
export function isPlayerAtExit(state: WorldState, exit: RoomExit, reach: number, playerId = 'player'): boolean {
  const player = playerOf(state, playerId)
  if (!player || player.roomId !== state.currentRoomId) {
    return false
  }
  return collision.gap(boxFromState(stateOf<TravellerState>(player)), exitZoneOf(exit)) <= reach
}

export type TravelResult =
  | { readonly status: 'entered'; readonly roomId: string }
  | { readonly status: 'ended' }
  | { readonly status: 'locked'; readonly reason: string }
  | { readonly status: 'missing' }

/** A held Weapon stays behind in the room being left: like files, objects belong to their room. */
function dropHeldWeapon(state: WorldState, player: WorldObject, playerState: TravellerState): void {
  if (!playerState.weaponId) {
    return
  }
  for (const worldObject of state.worldObjects) {
    const weapon = stateOf<Record<string, unknown>>(worldObject)
    if (weapon.equippedBy === player.id) {
      weapon.equippedBy = null
      weapon.x = playerState.x
      weapon.y = playerState.y
      weapon.vx = 0
      weapon.vy = 0
      weapon.thrown = null
      weapon.attackDurationMs = 0
      weapon.attackElapsedMs = 0
      weapon.attackOffsetX = 0
    }
  }
  playerState.weaponId = null
}

/**
 * Takes the Player Character through an Exit of the current room: into the target room at its entry
 * point, or to the end of the run for an Exit that `endsGame`. A locked Exit changes nothing.
 */
export function travelThroughExit(state: WorldState, exit: RoomExit, playerId = 'player'): TravelResult {
  const from = currentRoomOf(state)
  if (!from) {
    return { status: 'missing' }
  }
  const lockReason = exitLockReason(state, from, exit)
  if (lockReason) {
    return { status: 'locked', reason: lockReason }
  }
  if (exit.endsGame) {
    state.currentRoomId = exit.targetRoomId
    state.outcome = 'congratulations'
    return { status: 'ended' }
  }

  const to = state.rooms.find((room) => room.id === exit.targetRoomId)
  const player = playerOf(state, playerId)
  if (!to || !player) {
    return { status: 'missing' }
  }

  const playerState = stateOf<TravellerState>(player)
  dropHeldWeapon(state, player, playerState)

  state.rooms = state.rooms.map((room) => {
    if (room.id === from.id) {
      return { ...room, objectIds: room.objectIds.filter((id) => id !== player.id) }
    }
    if (room.id === to.id) {
      return { ...room, objectIds: room.objectIds.includes(player.id) ? room.objectIds : [...room.objectIds, player.id] }
    }
    return room
  })
  player.roomId = to.id

  const bounds = to.bounds
  const entry = to.entry ?? (bounds ? { x: bounds.left + 150, y: (bounds.top + bounds.bottom) / 2 } : { x: playerState.x, y: playerState.y })
  playerState.x = entry.x
  playerState.y = entry.y
  playerState.vx = 0
  playerState.vy = 0
  playerState.forceX = 0
  playerState.forceY = 0
  playerState.thrown = null
  if (to.restoresHealth && typeof playerState.maxHealth === 'number') {
    playerState.health = playerState.maxHealth
    playerState.alive = true
  }

  state.currentRoomId = to.id
  return { status: 'entered', roomId: to.id }
}
