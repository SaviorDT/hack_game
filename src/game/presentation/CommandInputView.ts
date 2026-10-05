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
  finishExecution(): void
  destroy(): void
}
