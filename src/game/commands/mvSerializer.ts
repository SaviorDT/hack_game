import type { MvConfig } from './mvConstants.ts'

/**
 * Serializes acceleration configuration into valid TypeScript source code
 * suitable for writing directly to src/game/commands/mvConstants.ts.
 */
export function generateMvConstantsSource(config: MvConfig): string {
  return `/**
 * Constants and configuration for the acc (throw) command.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_MV_ACCELERATION = ${config.mv_acceleration}

export interface MvConfig {
  mv_acceleration: number
  [key: string]: number
}

/** Shared runtime mv configuration, constant across all rooms. */
export const GAME_MV_CONFIG: MvConfig = {
  mv_acceleration: DEFAULT_MV_ACCELERATION,
}
`
}
