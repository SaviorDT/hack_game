import { ROOM_IDS } from './room1Constants.ts'
import { dagger, targetDummy, type RoomDefinition } from './roomPieces.ts'

/** Room ids that follow room2. room3 does not exist yet: going through room2's Hidden Exit ends the game. */
export const ROOM3_ID = 'room3'

/** Where room2's Target Dummy stands; the Hidden Exit appears on the same spot once it is defeated. */
export const ROOM2_DUMMY = { id: 'dummy2', x: 1490, y: 365 } as const

export const ROOM2_HINT = "One throw won't be enough. Maybe you can make the dagger fly around with you?"

/**
 * room2: a dagger on the left and a Target Dummy on the right, laid out like room1. Defeating the dummy reveals
 * a Hidden Exit to room3 where it stood.
 */
export const ROOM2_DEFINITION: RoomDefinition = {
  id: ROOM_IDS.second,
  hint: ROOM2_HINT,
  goal: 'Defeat the dummy, then walk into the exit.',
  objects: [
    dagger('room2dagger', 614, 611),
    targetDummy(ROOM2_DUMMY.id, ROOM2_DUMMY.x, ROOM2_DUMMY.y),
  ],
  exit: {
    targetRoomId: ROOM3_ID,
    label: ROOM3_ID,
    x: ROOM2_DUMMY.x,
    y: ROOM2_DUMMY.y,
    requires: { kind: 'defeat', objectIds: [ROOM2_DUMMY.id] },
    hiddenUntilOpen: true,
    endsGame: true,
  },
}
