import type { ParsedCommand } from '../ParsedCommand.ts'
import type { CommandResult } from '../CommandResult.ts'
import type { WorldState } from '../../domain/WorldState.ts'
import type { WorldObject } from '../../domain/WorldObject.ts'
import type { CommandExecutor } from './base.ts'
import type { CommandContext } from '../CommandContext.ts'
import { isMouseTarget, MOUSE_TARGET } from '../CommandContext.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import { isDestroyed, spendMvLimit } from '../../domain/MvLimit.ts'
import { visibleExitsOf } from '../../domain/RoomTravel.ts'
import { displayName, findObjectInRoom, wildcardToRegExp } from './commandHelpers.ts'

export class AccCommandExecutor implements CommandExecutor {
  execute(command: ParsedCommand, state: WorldState, context: CommandContext = {}): CommandResult {
    if (state.outcome !== 'playing') {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'This game has ended.' } }
    }
    if (command.arguments.length !== 2 || command.options.length > 0) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'Usage: acc <label1> <label2|$mouse>' } }
    }

    const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId)
    if (!currentRoom) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'No room is currently active.' } }
    }

    const label1 = command.arguments[0]
    const label2 = command.arguments[1]
    const toMouse = isMouseTarget(label2)
    if (toMouse && !context.mouse) {
      return { status: 'rejected', feedback: { kind: 'popup', text: 'Move the mouse over the game first.' } }
    }

    const targetObject = toMouse ? undefined : findObjectInRoom(state, label2)
    const normalizedTarget = label2.trim().toLowerCase().replace(/\/$/, '')
    const targetExit = toMouse ? undefined : visibleExitsOf(state, currentRoom).find(
      (exit) => exit.label.toLowerCase() === normalizedTarget || exit.targetRoomId.toLowerCase() === normalizedTarget,
    )
    if (!toMouse && !targetObject && !targetExit) {
      return { status: 'rejected', feedback: { kind: 'popup', text: `Cannot find "${label2}".` } }
    }

    let sources: WorldObject[]
    if (label1.includes('*')) {
      const matcher = wildcardToRegExp(label1)
      sources = state.worldObjects.filter((obj) =>
        obj.roomId === state.currentRoomId &&
        currentRoom.objectIds.includes(obj.id) &&
        obj.metadata.hidden !== true &&
        !isDestroyed(obj) &&
        obj.id !== targetObject?.id &&
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

    if (targetObject && sources.some((source) => source.id === targetObject.id)) {
      return {
        status: 'rejected',
        feedback: { kind: 'popup', text: `"${label1}" and "${label2}" are the same object.` },
      }
    }

    let targetX = 0
    let targetY = 0
    let targetObjectId: string | undefined
    let targetName = label2

    if (toMouse && context.mouse) {
      targetX = context.mouse.x
      targetY = context.mouse.y
      targetName = MOUSE_TARGET
    } else if (targetObject) {
      const targetState = getMutableWorldObjectState<{ x: number; y: number }>(targetObject)
      targetX = targetState.x
      targetY = targetState.y
      targetObjectId = targetObject.id
      targetName = displayName(targetObject)
    } else if (targetExit) {
      targetX = targetExit.x
      targetY = targetExit.y
      targetName = targetExit.label
    }

    const thrownNames: string[] = []
    const usedUpNames: string[] = []
    for (const sourceObject of sources) {
      if (!spendMvLimit(state, sourceObject)) {
        usedUpNames.push(displayName(sourceObject))
        continue
      }
      thrownNames.push(displayName(sourceObject))
      const sourceState = getMutableWorldObjectState<MutableWorldObjectState>(sourceObject)
      sourceState.discovered = true
      const currentX = (sourceState.x as number) ?? 0
      const currentY = (sourceState.y as number) ?? 0
      const distance = Math.hypot(targetX - currentX, targetY - currentY)

      if (distance === 0) {
        sourceState.x = targetX
        sourceState.y = targetY
        sourceState.vx = 0
        sourceState.vy = 0
        sourceState.thrown = null
      } else {
        sourceState.vx = (sourceState.vx as number | undefined) ?? 0
        sourceState.vy = (sourceState.vy as number | undefined) ?? 0
        sourceState.thrown = { targetX, targetY, targetObjectId: targetObjectId ?? null }
      }
    }

    const feedback: { kind: 'popup'; text: string }[] = []
    if (thrownNames.length > 0) {
      feedback.push({ kind: 'popup', text: `Threw ${thrownNames.join(', ')} to ${targetName}.` })
    }
    if (usedUpNames.length > 0) {
      feedback.push({
        kind: 'popup',
        text: `${usedUpNames.join(', ')} ${usedUpNames.length === 1 ? 'is' : 'are'} used up.`,
      })
    }
    return { status: 'success', feedback }
  }
}
