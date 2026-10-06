import type { ParsedCommand } from '../ParsedCommand.ts'
import type { CommandResult } from '../CommandResult.ts'
import type { WorldState } from '../../domain/WorldState.ts'
import type { CommandExecutor } from './base.ts'

export class HelpCommandExecutor implements CommandExecutor {
  private readonly commandNames: readonly string[]

  constructor(commandNames: readonly string[]) {
    this.commandNames = [...commandNames].sort((left, right) => left.localeCompare(right))
  }

  execute(command: ParsedCommand, _state: WorldState): CommandResult {
    if (command.arguments.length > 0 || command.options.length > 0) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'Usage: help' } }
    }

    return {
      status: 'success',
      feedback: [{ kind: 'popup', text: `Available commands:\n${this.commandNames.join('\n')}` }],
      // feedback: [{ kind: 'popup', text: `Available commands:\n${this.commandNames.join('\n')}\nPro tips:\nTyping autocomplete: Tab\nDelete a whole word: Ctrl+Backspace\nNavigate history: Arrow Up/Down` }],
    }
  }
}
