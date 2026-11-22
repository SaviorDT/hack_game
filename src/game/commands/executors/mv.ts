import type { ParsedCommand } from '../ParsedCommand.ts'
import type { CommandResult } from '../CommandResult.ts'
import type { WorldState } from '../../domain/WorldState.ts'
import type { WorldObject } from '../../domain/WorldObject.ts'
import type { CommandExecutor } from './base.ts'
import type { CommandContext } from '../CommandContext.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import { isDestroyed } from '../../domain/MvLimit.ts'
import { visibleExitsOf } from '../../domain/RoomTravel.ts'
import { hasUppercase } from '../../domain/label.ts'
import { displayName, findObjectInRoom, wildcardToRegExp } from './commandHelpers.ts'

function nextFreeName(base: string, taken: Set<string>, counter: { next: number }): string {
  for (;;) {
    const candidate = `${base}_${counter.next++}`
    if (!taken.has(candidate.toLowerCase())) {
      taken.add(candidate.toLowerCase())
      return candidate
    }
  }
}

export class MvCommandExecutor implements CommandExecutor {
  execute(command: ParsedCommand, state: WorldState, _context: CommandContext = {}): CommandResult {
    if (state.outcome !== 'playing') {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'This game has ended.' } }
    }
    if (command.arguments.length !== 2 || command.options.length > 0) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' } }
    }

    const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId)
    if (!currentRoom) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'No room is currently active.' } }
    }

    const label1 = command.arguments[0]
    const label2 = command.arguments[1]
    if (label2.toLowerCase() === '$mouse') {
      return { status: 'rejected', feedback: { kind: 'popup', text: '"$mouse" cannot be used as an object name.' } }
    }
    if (hasUppercase(label2)) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'Labels cannot contain uppercase letters.' } }
    }

    let sources: WorldObject[]
    if (label1.includes('*')) {
      const matcher = wildcardToRegExp(label1)
      sources = state.worldObjects.filter((obj) =>
        obj.roomId === state.currentRoomId &&
        currentRoom.objectIds.includes(obj.id) &&
        obj.metadata.hidden !== true &&
        !isDestroyed(obj) &&
        matcher.test(displayName(obj)),
      )
      if (sources.length === 0) {
        return { status: 'rejected', feedback: { kind: 'popup', text: `Cannot find "${label1}".` } }
      }
    } else {
      const sourceObject = findObjectInRoom(state, label1)
      if (!sourceObject) {
        return { status: 'rejected', feedback: { kind: 'popup', text: `Cannot find "${label1}".` } }
      }
      sources = [sourceObject]
    }

    if (sources.some((source) => displayName(source).toLowerCase() === label2.toLowerCase())) {
      return {
        status: 'rejected',
        feedback: { kind: 'popup', text: `"${label1}" and "${label2}" are the same object.` },
      }
    }

    const targetObject = findObjectInRoom(state, label2)
    const normalizedTarget = label2.trim().toLowerCase().replace(/\/$/, '')
    const targetExit = visibleExitsOf(state, currentRoom).find(
      (exit) => exit.label.toLowerCase() === normalizedTarget || exit.targetRoomId.toLowerCase() === normalizedTarget,
    )
    if (targetObject || targetExit) {
      return { status: 'rejected', feedback: { kind: 'popup', text: `"${label2}" already exists.` } }
    }

    const renames: string[] = []
    if (sources.length === 1) {
      renames.push(label2)
    } else {
      const sourceIds = new Set(sources.map((obj) => obj.id))
      const taken = new Set<string>()
      for (const obj of state.worldObjects) {
        if (obj.roomId === state.currentRoomId && !sourceIds.has(obj.id) && !isDestroyed(obj)) {
          taken.add(displayName(obj).toLowerCase())
        }
      }
      for (const exit of currentRoom.exits) {
        taken.add(exit.label.toLowerCase())
        taken.add(exit.targetRoomId.toLowerCase())
      }
      const counter = { next: 0 }
      for (let i = 0; i < sources.length; i++) {
        renames.push(nextFreeName(label2, taken, counter))
      }
    }

    const summaries = sources.map((obj, i) => {
      const oldName = displayName(obj)
      obj.rename(renames[i])
      getMutableWorldObjectState<MutableWorldObjectState>(obj).discovered = true
      return `${oldName} to ${renames[i]}`
    })

    return {
      status: 'success',
      feedback: [{ kind: 'popup', text: `Renamed ${summaries.join(', ')}.` }],
    }
  }
}
