import { describe, expect, it } from 'vitest'
import {
  isValidCommandSlot,
  loadCommandSlots,
  RECORD_HOLD_DURATION_MS,
  saveCommandSlots,
  VALID_COMMAND_SLOTS,
} from './commandSlots.ts'

describe('commandSlots', () => {
  it('exposes a positive hold duration constant', () => {
    expect(RECORD_HOLD_DURATION_MS).toBeGreaterThan(0)
  })

  it('validates only slots 8, 9, and 0', () => {
    expect(VALID_COMMAND_SLOTS).toEqual([8, 9, 0])
    expect(isValidCommandSlot(8)).toBe(true)
    expect(isValidCommandSlot(9)).toBe(true)
    expect(isValidCommandSlot(0)).toBe(true)
    expect(isValidCommandSlot('8')).toBe(true)
    expect(isValidCommandSlot('9')).toBe(true)
    expect(isValidCommandSlot('0')).toBe(true)

    expect(isValidCommandSlot(1)).toBe(false)
    expect(isValidCommandSlot(7)).toBe(false)
    expect(isValidCommandSlot(-1)).toBe(false)
    expect(isValidCommandSlot('abc')).toBe(false)
  })

  it('loads and saves slots via storage', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage

    expect(loadCommandSlots(storage)).toEqual({})

    saveCommandSlots({ 8: 'mv dagger $mouse', 9: 'ls' }, storage)
    expect(loadCommandSlots(storage)).toEqual({ 8: 'mv dagger $mouse', 9: 'ls' })
  })

  it('handles invalid json or corrupt storage gracefully', () => {
    const storage = {
      getItem: () => 'invalid json {',
      setItem: () => undefined,
    } as unknown as Storage

    expect(loadCommandSlots(storage)).toEqual({})
  })
})
