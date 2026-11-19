import { COMMAND_TYPING_MODES, type CommandTypingMode } from '../application/gameSettings.ts'

/** Focus positions on the Settings screen: one per typing mode, then RETURN. */
export const SETTING_RETURN_FOCUS = COMMAND_TYPING_MODES.length
export type SettingFocus = number

export function focusForMode(mode: CommandTypingMode): SettingFocus {
  return COMMAND_TYPING_MODES.indexOf(mode)
}

/** Returns the new focus for a navigation key, or `undefined` if the key does not navigate. */
export function nextSettingFocus(
  focus: SettingFocus,
  mode: CommandTypingMode,
  key: string,
): SettingFocus | undefined {
  const onReturn = focus === SETTING_RETURN_FOCUS
  if (key === 'ARROWLEFT' || key === 'A') return onReturn ? focus : Math.max(0, focus - 1)
  if (key === 'ARROWRIGHT' || key === 'D') {
    return onReturn ? focus : Math.min(SETTING_RETURN_FOCUS - 1, focus + 1)
  }
  if (key === 'ARROWUP' || key === 'W' || key === 'ARROWDOWN' || key === 'S') {
    return onReturn ? focusForMode(mode) : SETTING_RETURN_FOCUS
  }
  return undefined
}

/** Applies Enter on the Settings screen: the chosen mode, or `'return'` to leave. */
export function settingChoiceAt(focus: SettingFocus): CommandTypingMode | 'return' {
  return COMMAND_TYPING_MODES[focus] ?? 'return'
}
