/** Point in Room coordinates. */
export interface MousePoint {
  readonly x: number
  readonly y: number
}

/** Input facts a command may need that are not part of the world state (see Mouse Target). */
export interface CommandContext {
  /** The cursor in Room coordinates when the command was submitted; absent when there is none. */
  readonly mouse?: MousePoint
}

/** The `mv` target that stands for the cursor point; it can never be a World Object name. */
export const MOUSE_TARGET = '$mouse'

export function isMouseTarget(label: string): boolean {
  return label.trim().toLowerCase() === MOUSE_TARGET
}
