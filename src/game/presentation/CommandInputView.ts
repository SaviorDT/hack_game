import type Phaser from 'phaser'

export type CommandCompletionProvider = (
  rawText: string,
  cursorIndex: number,
) => readonly string[]

export type CommandHistoryProvider = () => readonly string[]

export interface CommandInputView {
  mount(
    scene: Phaser.Scene,
    onSubmit: (rawText: string) => void,
    completionProvider?: CommandCompletionProvider,
    historyProvider?: CommandHistoryProvider,
  ): void
  setPrompt(prompt: string): void
  setInputEnabled(enabled: boolean): void
  setKeyGate(gate: (event: KeyboardEvent) => boolean): void
  destroy(): void
}
