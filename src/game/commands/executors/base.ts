import type { ParsedCommand } from '../ParsedCommand.ts'
import type { CommandResult } from '../CommandResult.ts'
import type { WorldState } from '../../domain/WorldState.ts'
import type { CommandContext } from '../CommandContext.ts'

export interface CommandExecutor {
  execute(command: ParsedCommand, state: WorldState, context?: CommandContext): CommandResult
}
