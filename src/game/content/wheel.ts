import { TUTORIAL_ROOM_IDS } from './tutorialRoomIds.ts'
import { HOME_AREA_IDS } from './homeArea.ts'
import { dagger, targetDummy, type RoomDefinition } from './roomPieces.ts'

/** Where wheel's Target Dummy stands. */
export const WHEEL_DUMMY = { id: 'dummy2', x: 1490, y: 365, maxHealth: 200 } as const

export const WHEEL_HINT = "One throw won't be enough. Maybe you can make the dagger fly around with you?"

/**
 * wheel: a dagger on the left and a Target Dummy on the right, laid out like room. Defeating the dummy opens
 * the Exit to storage on the right wall.
 */
export const WHEEL_DEFINITION: RoomDefinition = {
  id: TUTORIAL_ROOM_IDS.flyAround,
  hint: WHEEL_HINT,
  goal: 'Defeat the dummy, then walk into the exit.',
  objects: [
    dagger('wheeldagger', 614, 611),
    targetDummy(WHEEL_DUMMY.id, WHEEL_DUMMY.x, WHEEL_DUMMY.y, { maxHealth: WHEEL_DUMMY.maxHealth }),
  ],
  exit: {
    targetRoomId: HOME_AREA_IDS.storage,
    label: HOME_AREA_IDS.storage,
    requires: { kind: 'defeat', objectIds: [WHEEL_DUMMY.id] },
  },
}
