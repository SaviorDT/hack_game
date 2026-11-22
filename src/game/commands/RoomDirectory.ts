import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import { isDestroyed } from '../domain/MvLimit.ts'
import type { Room } from '../domain/Room.ts'
import { visibleExitsOf } from '../domain/RoomTravel.ts'
import type { WorldState } from '../domain/WorldState.ts'

export function getRoomDirectoryEntries(
  state: WorldState,
  room: Room,
  discoverObjects: boolean,
  includePlayer = false,
): string[] {
  const entries: string[] = []

  for (const objectId of room.objectIds) {
    const worldObject = state.worldObjects.find((candidate) => candidate.id === objectId)
    if (!worldObject || worldObject.metadata.hidden === true || (!includePlayer && (worldObject.metadata.role === 'player' || worldObject.id === 'player'))) {
      continue
    }

    const name = typeof worldObject.metadata.name === 'string'
      ? worldObject.metadata.name
      : (worldObject.metadata.role === 'player' || worldObject.id === 'player' ? worldObject.id : undefined)
    if (typeof name !== 'string') {
      continue
    }

    if (isDestroyed(worldObject)) {
      continue
    }

    const discoverable = worldObject.metadata.discoverable === true
    const objectState = getMutableWorldObjectState<Record<string, string | number | boolean | null>>(
      worldObject,
    )

    if (discoverable && discoverObjects) {
      objectState.discovered = true
    }

    if (!discoverable || objectState.discovered === true) {
      entries.push(name)
    }
  }

  if (includePlayer) {
    const playerObject = state.worldObjects.find(
      (candidate) =>
        (candidate.roomId === room.id || room.objectIds.includes(candidate.id)) &&
        (candidate.metadata.role === 'player' || candidate.id === 'player'),
    )
    if (playerObject) {
      const playerName = typeof playerObject.metadata.name === 'string'
        ? playerObject.metadata.name
        : playerObject.id
      if (!entries.includes(playerName)) {
        entries.push(playerName)
      }
    }
  }

  entries.push(...visibleExitsOf(state, room).map((exit) => exit.label))
  return entries
}
