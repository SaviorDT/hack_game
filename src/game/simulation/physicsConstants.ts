/**
 * Constants and configuration for the physics step.
 * Constant across all rooms in the game world.
 */

export const DEFAULT_DRAG = 0.5
export const DEFAULT_MASS = 1
export const DEFAULT_MAX_VELOCITY = 700
export const DEFAULT_RESTITUTION = 0.5
export const DEFAULT_FRICTION = 1
export const DEFAULT_MIN_VELOCITY = 5
export const DEFAULT_MIN_COLLIDE_MOVE_VELOCITY = 50
export const MIN_MASS = 0.001

export interface PhysicsConfig {
  drag: number
  mass: number
  max_velocity: number
  restitution: number
  friction: number
  min_velocity: number
  min_collide_move_velocity: number
  [key: string]: number
}

/**
 * Shared runtime physics configuration, constant across all rooms.
 * `drag`, `mass`, `max_velocity`, `restitution` and `friction` are the defaults for objects that do not set their own.
 */
export const GAME_PHYSICS_CONFIG: PhysicsConfig = {
  drag: DEFAULT_DRAG,
  mass: DEFAULT_MASS,
  max_velocity: DEFAULT_MAX_VELOCITY,
  restitution: DEFAULT_RESTITUTION,
  friction: DEFAULT_FRICTION,
  min_velocity: DEFAULT_MIN_VELOCITY,
  min_collide_move_velocity: DEFAULT_MIN_COLLIDE_MOVE_VELOCITY,
}
