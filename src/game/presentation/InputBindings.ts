import type { MovementBindings } from '../application/InputModeController.ts'

export type MouseButtonName = 'left' | 'right'

interface ActionBinding {
  readonly keys: readonly string[]
  readonly mouseButtons: readonly MouseButtonName[]
}

export interface InputBindings {
  readonly movement: MovementBindings
  readonly enterCommandMode: readonly string[]
  readonly exitCommandMode: readonly string[]
  readonly attack: ActionBinding
}

// Keys are lowercase `KeyboardEvent.key` values.
export const INPUT_BINDINGS: InputBindings = {
  movement: {
    up: ['w'],
    down: ['s'],
    left: ['a'],
    right: ['d'],
  },
  enterCommandMode: ['shift'],
  exitCommandMode: [],
  attack: { keys: [' ', 'space'], mouseButtons: [] },
}

export function isAlphabetKey(event: {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}): boolean {
  return (
    event.key.length === 1 &&
    /^[a-zA-Z]$/.test(event.key) &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  )
}
