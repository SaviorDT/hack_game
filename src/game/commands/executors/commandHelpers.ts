import type { WorldObject } from '../../domain/WorldObject.ts'
import type { WorldState } from '../../domain/WorldState.ts'
import { isDestroyed } from '../../domain/MvLimit.ts'

export function findObjectInRoom(state: WorldState, label: string): WorldObject | undefined {
  const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId)
  if (!currentRoom) return undefined

  const normalized = label.trim().toLowerCase()
  const roomObjects = state.worldObjects.filter(
    (obj) =>
      obj.roomId === state.currentRoomId &&
      currentRoom.objectIds.includes(obj.id) &&
      obj.metadata.hidden !== true &&
      !isDestroyed(obj),
  )

  const byExactName = roomObjects.find((obj) => obj.metadata.name === label)
  if (byExactName) return byExactName

  const byCaseInsensitiveName = roomObjects.find((obj) =>
    typeof obj.metadata.name === 'string' && obj.metadata.name.toLowerCase() === normalized,
  )
  if (byCaseInsensitiveName) return byCaseInsensitiveName

  const byId = roomObjects.find((obj) => obj.id.toLowerCase() === normalized)
  if (byId) {
    const isRenamed =
      typeof byId.metadata.name === 'string' &&
      byId.metadata.name.toLowerCase() !== byId.id.toLowerCase() &&
      byId.metadata.role !== 'player'
    if (!isRenamed) return byId
  }

  return undefined
}

export function displayName(obj: WorldObject): string {
  return typeof obj.metadata.name === 'string' ? obj.metadata.name : obj.id
}

export function wildcardToRegExp(pattern: string): RegExp {
  const body = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}$`, 'i')
}
