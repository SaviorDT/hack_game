import { describe, expect, it } from 'vitest'
import { COMMAND_MODE_TIME_SCALE, InputModeController } from './InputModeController.ts'

const bindings = {
  up: ['w', 'arrowup'],
  down: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
}

const controller = () => new InputModeController(bindings)

describe('mode switching', () => {
  it('starts in movement mode at full time scale', () => {
    const input = controller()

    expect(input.mode).toBe('movement')
    expect(input.timeScale).toBe(1)
  })

  it('toggles between movement and command mode with the command time scale', () => {
    const input = controller()

    input.toggle()
    expect(input.mode).toBe('command')
    expect(input.timeScale).toBe(COMMAND_MODE_TIME_SCALE)
    expect(COMMAND_MODE_TIME_SCALE).toBe(0.25)

    input.toggle()
    expect(input.mode).toBe('movement')
    expect(input.timeScale).toBe(1)
  })

  it('returns to movement mode after a command by default', () => {
    const input = controller()
    input.toggle()

    input.finishCommand()

    expect(input.mode).toBe('movement')
  })

  it('stays in command mode when the command asks to keep input open', () => {
    const input = controller()
    input.toggle()

    input.finishCommand('command')

    expect(input.mode).toBe('command')
  })
})

describe('movement vector', () => {
  it('follows the held movement keys', () => {
    const input = controller()
    input.keyDown('w')

    expect(input.moveVector()).toEqual({ x: 0, y: -1 })
  })

  it('accepts arrow keys as well as WASD', () => {
    const input = controller()
    input.keyDown('arrowright')

    expect(input.moveVector()).toEqual({ x: 1, y: 0 })
  })

  it('normalizes diagonal movement', () => {
    const input = controller()
    input.keyDown('w')
    input.keyDown('d')

    const { x, y } = input.moveVector()
    expect(Math.hypot(x, y)).toBeCloseTo(1)
    expect(x).toBeGreaterThan(0)
    expect(y).toBeLessThan(0)
  })

  it('cancels opposite keys and stops when keys are released', () => {
    const input = controller()
    input.keyDown('a')
    input.keyDown('d')
    expect(input.moveVector()).toEqual({ x: 0, y: 0 })

    input.keyUp('a')
    input.keyUp('d')
    expect(input.moveVector()).toEqual({ x: 0, y: 0 })
  })
})

describe('entering command mode while moving', () => {
  it('keeps moving in the latched direction after the key is released', () => {
    const input = controller()
    input.keyDown('d')
    input.toggle()
    input.keyUp('d')

    expect(input.moveVector()).toEqual({ x: 1, y: 0 })
  })

  it('stops when returning to movement mode with nothing held', () => {
    const input = controller()
    input.keyDown('d')
    input.toggle()
    input.keyUp('d')
    input.toggle()

    expect(input.moveVector()).toEqual({ x: 0, y: 0 })
  })

  it('does not move in command mode when nothing was held at the switch', () => {
    const input = controller()
    input.toggle()
    input.keyDown('w')

    expect(input.moveVector()).toEqual({ x: 0, y: 0 })
  })

  it('does not type a movement key held through the switch, repeats included', () => {
    const input = controller()
    input.keyDown('d')
    input.toggle()

    expect(input.keyDown('d')).toEqual({ typeable: false })
    expect(input.keyDown('d')).toEqual({ typeable: false })

    input.keyUp('d')
    expect(input.keyDown('d')).toEqual({ typeable: true })
  })

  it('types keys that were not held at the switch', () => {
    const input = controller()
    input.keyDown('d')
    input.toggle()

    expect(input.keyDown('w')).toEqual({ typeable: true })
    expect(input.keyDown('x')).toEqual({ typeable: true })
  })

  it('resumes live key movement when a command finishes with a key still held', () => {
    const input = controller()
    input.toggle()
    input.keyDown('s')
    input.finishCommand()

    expect(input.moveVector()).toEqual({ x: 0, y: 1 })
  })
})
