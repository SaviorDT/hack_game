export type CommandTypingMode = 'hold-shift' | 'enter-sticky'

export const COMMAND_TYPING_MODE_KEY = 'hack-game.command-typing-mode'
export const DEFAULT_COMMAND_TYPING_MODE: CommandTypingMode = 'hold-shift'

export function loadCommandTypingMode(storage?: Storage): CommandTypingMode {
  try {
    const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
    const val = targetStorage?.getItem(COMMAND_TYPING_MODE_KEY)
    if (val === 'enter-sticky' || val === 'hold-shift') {
      return val
    }
  } catch {}
  return DEFAULT_COMMAND_TYPING_MODE
}

export function saveCommandTypingMode(mode: CommandTypingMode, storage?: Storage): void {
  try {
    const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
    targetStorage?.setItem(COMMAND_TYPING_MODE_KEY, mode)
  } catch {}
}
