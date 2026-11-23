import { TUTORIAL_ROOM_IDS } from './tutorialRoomIds.ts'
import { HOME_AREA_IDS } from './homeArea.ts'
import { dagger, targetDummy, type RoomDefinition } from './roomPieces.ts'

/** Where tutorial5's Target Dummy stands; the Hidden Exit appears on the same spot once it is defeated. */
export const TUTORIAL5_DUMMY = { id: 'dummy2', x: 1490, y: 365 } as const

export const TUTORIAL5_HINT = "One throw won't be enough. Maybe you can make the dagger fly around with you?"

/**
 * tutorial5: a dagger on the left and a Target Dummy on the right, laid out like room. Defeating the dummy reveals
 * a Hidden Exit to storage where it stood.
 */
export const TUTORIAL5_DEFINITION: RoomDefinition = {
  id: TUTORIAL_ROOM_IDS.flyAround,
  hint: TUTORIAL5_HINT,
  goal: 'Defeat the dummy, then walk into the exit.',
  objects: [
    dagger('tutorial5dagger', 614, 611),
    targetDummy(TUTORIAL5_DUMMY.id, TUTORIAL5_DUMMY.x, TUTORIAL5_DUMMY.y),
  ],
  exit: {
    targetRoomId: HOME_AREA_IDS.storage,
    label: HOME_AREA_IDS.storage,
    x: TUTORIAL5_DUMMY.x,
    y: TUTORIAL5_DUMMY.y,
    requires: { kind: 'defeat', objectIds: [TUTORIAL5_DUMMY.id] },
    hiddenUntilOpen: true,
  },
}
