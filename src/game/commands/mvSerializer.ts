import type { MvConfig } from './mvConstants.ts'

/**
 * Serializes mv configuration into valid TypeScript source code
 * suitable for writing directly to src/game/commands/mvConstants.ts.
 */
export function generateMvConstantsSource(config: MvConfig): string {
  return `/**
 * Constants and configuration for the mv (throw) command.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_MV_FORCE = ${config.mv_force}
export const DEFAULT_MV_DRAG = ${config.drag}
export const DEFAULT_MV_MASS = ${config.mass}
export const DEFAULT_MV_MAX_VELOCITY = ${config.max_velocity}
export const MIN_MV_MASS = 0.001

export interface MvConfig {
  mv_force: number
  drag: number
  mass: number
  max_velocity: number
  [key: string]: number
}

/**
 * Shared runtime mv configuration, constant across all rooms.
 * \`drag\`, \`mass\` and \`max_velocity\` are the defaults for objects without a \`mv_attr\` override.
 */
export const GAME_MV_CONFIG: MvConfig = {
  mv_force: DEFAULT_MV_FORCE,
  drag: DEFAULT_MV_DRAG,
  mass: DEFAULT_MV_MASS,
  max_velocity: DEFAULT_MV_MAX_VELOCITY,
}
`
}
