export const ROOM_IDS = {
  main: 'room',
  end: 'end',
} as const

export const ROOM_NAMES: Readonly<Record<string, string>> = {
  [ROOM_IDS.main]: 'room',
  [ROOM_IDS.end]: 'end',
}

export const WORLD_OBJECT_IDS = {
  player: 'player',
  dagger: 'dagger',
  guard: 'guard',
  boulder: 'boulder',
} as const

export const PROCESS_IDS = {
  player: 'player-movement',
  dagger: 'dagger-pickup',
  guard: 'guard-response',
  boulder: 'boulder-behavior',
  archer: 'archer-shoot',
  arrow: 'arrow-flight',
  boss: 'boss-attacks',
  blade: 'blade-flight',
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
export const BOULDER_SIZE = { width: 120, height: 120 } as const
export const BOULDER_BASE_SIZE = { width: 128, height: 128 } as const
export const MAX_HEALTH = 100

export {
  DEFAULT_DAGGER_SIZE,
  DAGGER_SIZE,
  DEFAULT_WEAPON_HOLD_OFFSET,
  WEAPON_HOLD_OFFSET,
  DEFAULT_DAGGER_ATTACK_DISTANCE,
  DEFAULT_DAGGER_ATTACK_DURATION_MS,
  DAGGER_ATTACK_DISTANCE,
  DAGGER_ATTACK_DURATION_MS,
  type WeaponConfig,
  GAME_WEAPON_CONFIG,
  resetGameWeaponConfig,
  computeDaggerAttackTranslation,
  startDaggerAttackAnimation,
} from './weaponConstants.ts'


