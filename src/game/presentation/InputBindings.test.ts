import { describe, expect, it } from 'vitest'
import { INPUT_BINDINGS, isAlphabetKey } from './InputBindings.ts'

describe('INPUT_BINDINGS', () => {
  it('contains wasd in movement bindings', () => {
    expect(INPUT_BINDINGS.movement.up).toEqual(['w'])
    expect(INPUT_BINDINGS.movement.down).toEqual(['s'])
    expect(INPUT_BINDINGS.movement.left).toEqual(['a'])
    expect(INPUT_BINDINGS.movement.right).toEqual(['d'])
  })

  it('does not bind arrow keys for movement', () => {
    const allMovementKeys = [
      ...INPUT_BINDINGS.movement.up,
      ...INPUT_BINDINGS.movement.down,
      ...INPUT_BINDINGS.movement.left,
      ...INPUT_BINDINGS.movement.right,
    ]
    expect(allMovementKeys).not.toContain('arrowup')
    expect(allMovementKeys).not.toContain('arrowdown')
    expect(allMovementKeys).not.toContain('arrowleft')
    expect(allMovementKeys).not.toContain('arrowright')
  })

  it('binds spacebar for attack and no mouse buttons', () => {
    expect(INPUT_BINDINGS.attack.keys).toContain(' ')
    expect(INPUT_BINDINGS.attack.mouseButtons).toEqual([])
  })

  it('has no keys to exit command mode via keypress', () => {
    expect(INPUT_BINDINGS.exitCommandMode).toEqual([])
  })

  it('binds shift to enter command mode', () => {
    expect(INPUT_BINDINGS.enterCommandMode).toEqual(['shift'])
  })
})

describe('isAlphabetKey', () => {
  it('recognizes lowercase and uppercase alphabets', () => {
    for (const char of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(isAlphabetKey({ key: char })).toBe(true)
    }
  })

  it('rejects arrow keys', () => {
    expect(isAlphabetKey({ key: 'ArrowUp' })).toBe(false)
    expect(isAlphabetKey({ key: 'ArrowDown' })).toBe(false)
    expect(isAlphabetKey({ key: 'ArrowLeft' })).toBe(false)
    expect(isAlphabetKey({ key: 'ArrowRight' })).toBe(false)
  })

  it('rejects functional and whitespace keys', () => {
    expect(isAlphabetKey({ key: 'Enter' })).toBe(false)
    expect(isAlphabetKey({ key: 'Tab' })).toBe(false)
    expect(isAlphabetKey({ key: ' ' })).toBe(false)
    expect(isAlphabetKey({ key: 'Backspace' })).toBe(false)
    expect(isAlphabetKey({ key: 'F2' })).toBe(false)
    expect(isAlphabetKey({ key: 'Escape' })).toBe(false)
  })

  it('rejects numbers and symbols', () => {
    expect(isAlphabetKey({ key: '1' })).toBe(false)
    expect(isAlphabetKey({ key: '0' })).toBe(false)
    expect(isAlphabetKey({ key: '-' })).toBe(false)
    expect(isAlphabetKey({ key: '$' })).toBe(false)
  })

  it('rejects alphabet keys when modifier keys are held', () => {
    expect(isAlphabetKey({ key: 'c', ctrlKey: true })).toBe(false)
    expect(isAlphabetKey({ key: 'z', ctrlKey: true })).toBe(false)
    expect(isAlphabetKey({ key: 'a', altKey: true })).toBe(false)
    expect(isAlphabetKey({ key: 'v', metaKey: true })).toBe(false)
  })
})

