import { BOSS_CONFIG } from './bossConstants.ts'
import { ROOM_IDS } from './roomConstants.ts'
import { ROOM_BOUNDS, boss, dagger, plate, type RoomDefinition } from './roomPieces.ts'

export const ARENA_IDS = {
  room: 'arena',
  boss: 'warden',
} as const

/** Half a plate's side: a plate this far in from the room's bounds lies flat against the wall. */
const PLATE_INSET = 40
const LEFT = ROOM_BOUNDS.left + PLATE_INSET
const RIGHT = ROOM_BOUNDS.right - PLATE_INSET
const TOP = ROOM_BOUNDS.top + PLATE_INSET
const BOTTOM = ROOM_BOUNDS.bottom - PLATE_INSET
const CENTER_X = (ROOM_BOUNDS.left + ROOM_BOUNDS.right) / 2
const CENTER_Y = (ROOM_BOUNDS.top + ROOM_BOUNDS.bottom) / 2

/** Eight plates in the corners and the middle of each side, named after where they are, for the player to `acc` to. */
export const ARENA_PLATES = [
  { name: 't', x: CENTER_X, y: TOP },
  { name: 'tr', x: RIGHT, y: TOP },
  { name: 'r', x: RIGHT, y: CENTER_Y },
  { name: 'br', x: RIGHT, y: BOTTOM },
  { name: 'b', x: CENTER_X, y: BOTTOM },
  { name: 'bl', x: LEFT, y: BOTTOM },
  { name: 'l', x: LEFT, y: CENTER_Y },
  { name: 'tl', x: LEFT, y: TOP },
] as const

/**
 * The last room, played after room: a bare floor, so a Boss that chases, fans out Blades and dashes has nothing to
 * hide behind but the walls. Eight plates give the player places to `acc` to. Defeating the Boss opens the Exit at
 * the right wall, which ends the game.
 */
export const ARENA_DEFINITION: RoomDefinition = {
  id: ARENA_IDS.room,
  goal: 'Defeat the warden, then walk into the exit.',
  objects: [
    dagger('arenaexcalibur', 360, 600, { name: 'excalibur' }),
    boss(ARENA_IDS.boss, 1500, 365, { maxHealth: BOSS_CONFIG.maxHealth }),
    ...ARENA_PLATES.map(({ name, x, y }) => plate(`arena${name}`, x, y, name)),
  ],
  exit: {
    targetRoomId: ROOM_IDS.end,
    label: ROOM_IDS.end,
    requires: { kind: 'defeat', objectIds: [ARENA_IDS.boss] },
    endsGame: true,
  },
}
