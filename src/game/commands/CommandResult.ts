import type { CommandFeedback } from './CommandFeedback.ts'

export type InputModeAfterCommand = 'movement' | 'command'

export type CommandResult =
  | {
      readonly status: 'success'
      readonly feedback: readonly CommandFeedback[]
      readonly inputAfter?: InputModeAfterCommand
    }
  | {
      readonly status: 'rejected'
      readonly feedback: CommandFeedback
      readonly inputAfter?: InputModeAfterCommand
    }
