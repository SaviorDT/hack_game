import { getMutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import type { ParsedCommand } from '../ParsedCommand.ts'
import type { CommandResult } from '../CommandResult.ts'
import type { WorldState } from '../../domain/WorldState.ts'
import type { CommandExecutor } from './base.ts'

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

    const entries: string[] = []

    for (const objectId of currentRoom.objectIds) {
      const worldObject = state.worldObjects.find((candidate) => candidate.id === objectId)
      if (!worldObject || worldObject.metadata.role === 'player') {
        continue
      }

      const name = worldObject.metadata.name
      if (typeof name !== 'string') {
        continue
      }

      const discoverable = worldObject.metadata.discoverable === true
      const objectState = getMutableWorldObjectState<Record<string, string | number | boolean | null>>(
        worldObject,
      )

      if (discoverable) {
        objectState.discovered = true
      }

      if (objectState.discovered === true) {
        entries.push(name)
      }
    }

    entries.push(...currentRoom.exits.map((exit) => exit.label))

    return {
      status: 'success',
      feedback: [{ kind: 'popup', text: entries.length > 0 ? entries.join('\n') : 'Nothing to list.' }],
    }
  }
}
