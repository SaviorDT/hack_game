/**
 * Constants and configuration for the acc (throw) command.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_MV_ACCELERATION = 4000

export interface MvConfig {
  mv_acceleration: number
  [key: string]: number
}

/** Shared runtime mv configuration, constant across all rooms. */
export const GAME_MV_CONFIG: MvConfig = {
  mv_acceleration: DEFAULT_MV_ACCELERATION,
}
