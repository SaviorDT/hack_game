export const ROOM_IDS = {
  first: 'room1',
  second: 'room2',
} as const

export const ROOM_NAMES: Readonly<Record<string, string>> = {
  [ROOM_IDS.first]: 'room1',
  [ROOM_IDS.second]: 'room2',
}

export const WORLD_OBJECT_IDS = {
  player: 'player',
  dagger: 'dagger',
  guard: 'guard',
} as const

export const PROCESS_IDS = {
  player: 'player-movement',
  dagger: 'dagger-pickup',
  guard: 'guard-response',
} as const

export const ROOM_LAYOUT = {
  width: 1920,
  height: 748,
  left: 96,
  top: 80,
  right: 1824,
  bottom: 700,
  rightHalfStartX: 960,
  exit: { x: 1770, y: 365 },
  exitZone: { x: 1770, y: 365, width: 60, height: 160 },
  playerStart: { x: 250, y: 205 },
  daggerStart: { x: 325, y: 610 },
  guardStart: { x: 1490, y: 365 },
} as const

export const CHARACTER_SIZE = { width: 110, height: 160 } as const
export const CHARACTER_BASE_SIZE = { width: 176, height: 176 } as const
export const DAGGER_SIZE = { width: 72, height: 72 } as const
export const MAX_HEALTH = 100

