import type { MovementBindings } from '../application/InputModeController.ts'

export type MouseButtonName = 'left' | 'right'

interface ActionBinding {
  readonly keys: readonly string[]
  readonly mouseButtons: readonly MouseButtonName[]
}

export interface InputBindings {
  readonly movement: MovementBindings
  readonly toggleMode: readonly string[]
  readonly attack: ActionBinding
}

// Keys are lowercase `KeyboardEvent.key` values.
export const INPUT_BINDINGS: InputBindings = {
  movement: {
    up: ['w', 'arrowup'],
    down: ['s', 'arrowdown'],
    left: ['a', 'arrowleft'],
    right: ['d', 'arrowright'],
  },
  toggleMode: ['enter'],
  attack: { keys: ['j'], mouseButtons: ['left'] },
}
