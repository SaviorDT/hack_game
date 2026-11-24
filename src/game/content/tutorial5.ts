import { TUTORIAL_ROOM_IDS } from './tutorialRoomIds.ts'
import { HOME_AREA_IDS } from './homeArea.ts'
import { ARENA_PLATES } from './arena.ts'
import { plate, type RoomDefinition } from './roomPieces.ts'

/** Arena plates tutorial5 leaves out: the top row (under the hint banner) and `r` (under the Exit). */
const HIDDEN_PLATES: readonly string[] = ['tl', 't', 'tr', 'r']

/**
 * tutorial5's plates: the arena's plates with the same names and places, minus those the hint banner or the Exit
 * would cover, so the player practises `acc hacker <plate>` on the names they will need against the Boss.
 */
export const TUTORIAL5_PLATES = ARENA_PLATES.filter(({ name }) => !HIDDEN_PLATES.includes(name)).map(
  ({ name, x, y }) => ({ id: `tutorial5${name}`, name, x, y }),
)

export const TUTORIAL5_HINT = 'You can throw yourself too. Try: acc hacker bl, then acc hacker storage'

/**
 * tutorial5: teaches throwing yourself, the way tutorial4 teaches `$mouse`: the hint shows the command and the room
 * is built around it, but walking works too. The Exit to storage on the right wall is open from the start.
 */
export const TUTORIAL5_DEFINITION: RoomDefinition = {
  id: TUTORIAL_ROOM_IDS.selfThrow,
  hint: TUTORIAL5_HINT,
  goal: 'Throw yourself to the exit.',
  objects: TUTORIAL5_PLATES.map(({ id, name, x, y }) => plate(id, x, y, name)),
  exit: { targetRoomId: HOME_AREA_IDS.storage, label: HOME_AREA_IDS.storage },
}
