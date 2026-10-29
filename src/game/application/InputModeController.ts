export type InputMode = 'movement' | 'command'
export type Direction = 'up' | 'down' | 'left' | 'right'
export type MovementBindings = Readonly<Record<Direction, readonly string[]>>

export interface MoveVector {
  readonly x: number
  readonly y: number
}

export const COMMAND_MODE_TIME_SCALE = 0.25
export const MOVEMENT_MODE_TIME_SCALE = 1

const STILL: MoveVector = { x: 0, y: 0 }

export class InputModeController {
  private readonly bindings: MovementBindings
  private readonly heldKeys = new Set<string>()
  private suppressedKeys = new Set<string>()
  private latchedVector: MoveVector = STILL
  private currentMode: InputMode = 'movement'

  constructor(bindings: MovementBindings) {
    this.bindings = bindings
  }

  get mode(): InputMode {
    return this.currentMode
  }

  get timeScale(): number {
    return this.currentMode === 'command' ? COMMAND_MODE_TIME_SCALE : MOVEMENT_MODE_TIME_SCALE
  }

  toggle(): void {
    if (this.currentMode === 'movement') {
      this.enterCommandMode()
    } else {
      this.enterMovementMode()
    }
  }

  finishCommand(inputAfter: InputMode = 'movement'): void {
    if (inputAfter === 'movement' && this.currentMode === 'command') {
      this.enterMovementMode()
    }
  }

  keyDown(key: string): { typeable: boolean } {
    this.heldKeys.add(key)
    return { typeable: this.currentMode === 'command' && !this.suppressedKeys.has(key) }
  }

  keyUp(key: string): void {
    this.heldKeys.delete(key)
    this.suppressedKeys.delete(key)
  }

  releaseAll(): void {
    this.heldKeys.clear()
    this.suppressedKeys.clear()
  }

  moveVector(): MoveVector {
    return this.currentMode === 'command' ? this.latchedVector : this.heldVector()
  }

  private enterCommandMode(): void {
    this.latchedVector = this.heldVector()
    this.suppressedKeys = new Set(this.heldKeys)
    this.currentMode = 'command'
  }

  private enterMovementMode(): void {
    this.latchedVector = STILL
    this.suppressedKeys.clear()
    this.currentMode = 'movement'
  }

  private heldVector(): MoveVector {
    const pressed = (direction: Direction) =>
      this.bindings[direction].some((key) => this.heldKeys.has(key)) ? 1 : 0
    const x = pressed('right') - pressed('left')
    const y = pressed('down') - pressed('up')
    const length = Math.hypot(x, y)
    return length === 0 ? STILL : { x: x / length, y: y / length }
  }
}
