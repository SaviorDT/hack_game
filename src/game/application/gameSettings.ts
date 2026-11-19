export type CommandTypingMode = 'hold-shift' | 'hybrid' | 'enter-sticky'

/** Display / cycling order of the Command Typing Mode choices. */
export const COMMAND_TYPING_MODES: readonly CommandTypingMode[] = ['hold-shift', 'hybrid', 'enter-sticky']

/** Whether holding Shift opens the Command Input (and releasing it closes it). */
export function shiftOpensCommandInput(mode: CommandTypingMode): boolean {
  return mode !== 'enter-sticky'
}

/** Whether pressing Enter opens the Command Input from Movement Mode. */
export function enterOpensCommandInput(mode: CommandTypingMode): boolean {
  return mode !== 'hold-shift'
}

export const COMMAND_TYPING_MODE_KEY = 'hack-game.command-typing-mode'
export const DEFAULT_COMMAND_TYPING_MODE: CommandTypingMode = 'hold-shift'

export function loadCommandTypingMode(storage?: Storage): CommandTypingMode {
  try {
    const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
    const val = targetStorage?.getItem(COMMAND_TYPING_MODE_KEY)
    if (val === 'enter-sticky' || val === 'hold-shift' || val === 'hybrid') {
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
