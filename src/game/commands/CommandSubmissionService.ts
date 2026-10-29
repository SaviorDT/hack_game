import type { CommandParser } from './CommandParser.ts'
import type { CommandRegistry } from './CommandRegistry.ts'
import type { CommandRequirementChecker } from './CommandRequirementChecker.ts'
import type { CommandResult } from './CommandResult.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { getRoomDirectoryEntries } from './RoomDirectory.ts'

export class CommandSubmissionService {
  private readonly parser: CommandParser
  private readonly registry: CommandRegistry
  private readonly requirementChecker: CommandRequirementChecker

  constructor(
    parser: CommandParser,
    registry: CommandRegistry,
    requirementChecker: CommandRequirementChecker,
  ) {
    this.parser = parser
    this.registry = registry
    this.requirementChecker = requirementChecker
  }

  submit(rawText: string, state: WorldState): CommandResult {
    const parseResult = this.parser.parse(rawText)
    if (!parseResult.ok) {
      return { status: 'rejected', feedback: { kind: 'popup', text: parseResult.reason } }
    }

    const registeredCommand = this.registry.resolve(parseResult.command.name)
    if (!registeredCommand) {
      return {
        status: 'rejected',
        feedback: { kind: 'popup', text: `Unknown command: ${parseResult.command.name}` },
      }
    }

    const requirementResult = this.requirementChecker.check(
      registeredCommand.requirements,
      parseResult.command,
      state,
    )
    if (!requirementResult.ok) {
      return { status: 'rejected', feedback: { kind: 'popup', text: requirementResult.reason } }
    }

    return registeredCommand.executor.execute(parseResult.command, state)
  }

  getCompletionCandidates(_rawText: string, _cursorIndex: number, state: WorldState): readonly string[] {
    const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId)
    if (!currentRoom) {
      return this.registry.names()
    }

    const directoryEntries = getRoomDirectoryEntries(state, currentRoom, false)
    const roomEntries = directoryEntries.map((entry) =>
      currentRoom.exits.some((exit) => exit.label === entry) ? `${entry}/` : entry,
    )
    return [...this.registry.names(), ...roomEntries]
  }
}
