/**
 * Ids of the Tutorial Rooms, in play order. Kept apart from `tutorialRooms.ts` so a room definition
 * (such as tutorial5's) can name its own id without importing the list that contains it.
 */
export const TUTORIAL_ROOM_IDS = {
  move: 'tutorial1',
  throw: 'tutorial2',
  slowTime: 'tutorial3',
  mouseThrow: 'tutorial4',
  selfThrow: 'tutorial5',
} as const
