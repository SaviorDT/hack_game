import type { ParsedCommand } from '../ParsedCommand.ts'
import type { CommandResult } from '../CommandResult.ts'
import type { WorldState } from '../../domain/WorldState.ts'
import type { CommandExecutor } from './base.ts'
import { getRoomDirectoryEntries } from '../RoomDirectory.ts'

export class LsCommandExecutor implements CommandExecutor {
  execute(command: ParsedCommand, state: WorldState): CommandResult {
    if (state.outcome !== 'playing') {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'This game has ended.' } }
    }

    if (command.arguments.length > 0 || command.options.length > 0) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'Usage: ls' } }
    }

    const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId)
    if (!currentRoom) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'No room is currently active.' } }
    }

    const entries = getRoomDirectoryEntries(state, currentRoom, true)

    return {
      status: 'success',
      feedback: [{
        kind: 'popup',
        text: entries.length > 0 ? entries.join('\n') : 'Nothing to list.',
        reverseColorLines: currentRoom.exits.map((exit) => exit.label),
      }],
    }
  }
}
