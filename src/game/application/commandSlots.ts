export const VALID_COMMAND_SLOTS = [8, 9, 0] as const
export type CommandSlot = (typeof VALID_COMMAND_SLOTS)[number]
export type CommandSlotMap = Partial<Record<CommandSlot, string>>

export const DEFAULT_RECORD_HOLD_DURATION_MS = 250
export const RECORD_HOLD_DURATION_MS = DEFAULT_RECORD_HOLD_DURATION_MS
export const RECORD_HOLD_SHOW_DELAY_MS = RECORD_HOLD_DURATION_MS / 2

export const COMMAND_SLOTS_STORAGE_KEY = 'hack-game.command-slots'

export function isValidCommandSlot(slot: number | string): slot is CommandSlot {
  const num = typeof slot === 'string' ? Number(slot) : slot
  return (VALID_COMMAND_SLOTS as readonly number[]).includes(num)
}

export function loadCommandSlots(storage?: Storage): CommandSlotMap {
  try {
    const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
    const raw = targetStorage?.getItem(COMMAND_SLOTS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        const result: CommandSlotMap = {}
        for (const slot of VALID_COMMAND_SLOTS) {
          if (typeof (parsed as Record<string, unknown>)[slot] === 'string') {
            result[slot] = (parsed as Record<string, string>)[slot]
          }
        }
        return result
      }
    }
  } catch { }
  return {}
}

export function saveCommandSlots(slots: CommandSlotMap, storage?: Storage): void {
  try {
    const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
    targetStorage?.setItem(COMMAND_SLOTS_STORAGE_KEY, JSON.stringify(slots))
  } catch { }
}
