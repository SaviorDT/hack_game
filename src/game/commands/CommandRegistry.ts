import type { CommandRequirement } from './CommandRequirement.ts'
import type { CommandExecutor } from './executors/base.ts'

export interface RegisteredCommand {
  readonly name: string
  readonly requirements: readonly CommandRequirement[]
  readonly executor: CommandExecutor
}

export interface CommandRegistry {
  resolve(name: string): RegisteredCommand | undefined
  names(): readonly string[]
}
