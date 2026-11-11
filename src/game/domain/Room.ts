import type { Box, Bounds } from './CollisionWorld.ts'
import type { WorldObjectId, RoomId } from './ids.ts'
import type { JsonValue } from './JsonValue.ts'
import { assertValidLabel } from './label.ts'

/** What must be true in a Room before its Exit opens. */
export type ExitRequirement =
  /** Every listed World Object is defeated (or no longer in the room). */
  | { readonly kind: 'defeat'; readonly objectIds: readonly WorldObjectId[] }
  /** Every discoverable World Object in the room has been discovered. */
  | { readonly kind: 'discover-all' }
  /** Every listed pressure plate is pressed right now (the Exit locks again when one is released). */
  | { readonly kind: 'pressed'; readonly plateIds: readonly WorldObjectId[] }

export interface RoomExit {
  readonly targetRoomId: RoomId
  readonly label: string
  readonly x: number
  readonly y: number
  /** Locks the Exit until met; with a list, until every one is met. */
  readonly requires?: ExitRequirement | readonly ExitRequirement[]
  /** Going through ends the run with `congratulations` instead of entering the target room. */
  readonly endsGame?: boolean
}

export function assertValidRoomExit(exit: RoomExit): void {
  assertValidLabel(exit.label, 'room exit label')
}

export function assertValidRoom(room: Room): void {
  for (const exit of room.exits) {
    assertValidRoomExit(exit)
  }
}

export interface Room {
  readonly id: RoomId
  readonly objectIds: readonly WorldObjectId[]
  readonly exits: readonly RoomExit[]
  readonly state: JsonValue
  /** The area bodies stay inside; without it the room has no edge. */
  readonly bounds?: Bounds
  /** Where the Player Character appears when entering this room. */
  readonly entry?: { readonly x: number; readonly y: number }
  /** Teaching text shown on screen in this room and by `help`. */
  readonly hint?: string
  /** One-line objective shown in the HUD; for a locked Exit, what unlocks it. */
  readonly goal?: string
  /** Entering the room restores the Player Character's Health. */
  readonly restoresHealth?: boolean
  /** Solid, immovable walls inside the room (centre and size, like any collider). Every body, thrown object and arrow stops at them. */
  readonly walls?: readonly Box[]
}

/** A wall from its edges, which is how room layouts are easiest to write. */
export function wallFromEdges(left: number, top: number, right: number, bottom: number): Box {
  return { x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top }
}
