import { describe, expect, it } from 'vitest'
import {
  COMMAND_TYPING_MODE_KEY,
  DEFAULT_COMMAND_TYPING_MODE,
  loadCommandTypingMode,
  saveCommandTypingMode,
} from './gameSettings.ts'

describe('gameSettings', () => {
  function createMockStorage(): Storage {
    const map = new Map<string, string>()
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value)
      },
      removeItem: (key: string) => {
        map.delete(key)
      },
      clear: () => {
        map.clear()
      },
      key: (index: number) => Array.from(map.keys())[index] ?? null,
      get length() {
        return map.size
      },
    }
  }

  it('returns default mode when storage is empty', () => {
    const storage = createMockStorage()
    expect(loadCommandTypingMode(storage)).toBe(DEFAULT_COMMAND_TYPING_MODE)
    expect(DEFAULT_COMMAND_TYPING_MODE).toBe('hold-shift')
  })

  it('loads valid stored modes', () => {
    const storage = createMockStorage()
    storage.setItem(COMMAND_TYPING_MODE_KEY, 'enter-sticky')
    expect(loadCommandTypingMode(storage)).toBe('enter-sticky')

    storage.setItem(COMMAND_TYPING_MODE_KEY, 'hold-shift')
    expect(loadCommandTypingMode(storage)).toBe('hold-shift')
  })

  it('falls back to default for invalid stored values', () => {
    const storage = createMockStorage()
    storage.setItem(COMMAND_TYPING_MODE_KEY, 'invalid-mode')
    expect(loadCommandTypingMode(storage)).toBe('hold-shift')
  })

  it('saves typing mode to storage', () => {
    const storage = createMockStorage()
    saveCommandTypingMode('enter-sticky', storage)
    expect(storage.getItem(COMMAND_TYPING_MODE_KEY)).toBe('enter-sticky')

    saveCommandTypingMode('hold-shift', storage)
    expect(storage.getItem(COMMAND_TYPING_MODE_KEY)).toBe('hold-shift')
  })

  it('handles missing or throwing storage gracefully', () => {
    const throwingStorage: Storage = {
      getItem: () => {
        throw new Error('Denied')
      },
      setItem: () => {
        throw new Error('Denied')
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    }

    expect(loadCommandTypingMode(throwingStorage)).toBe('hold-shift')
    expect(() => saveCommandTypingMode('enter-sticky', throwingStorage)).not.toThrow()
  })
})
