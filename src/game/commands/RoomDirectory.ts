import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import type { Room } from '../domain/Room.ts'
import type { WorldState } from '../domain/WorldState.ts'

export function getRoomDirectoryEntries(
  state: WorldState,
  room: Room,
  discoverObjects: boolean,
): string[] {
  const entries: string[] = []

  for (const objectId of room.objectIds) {
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

    if (discoverable && discoverObjects) {
      objectState.discovered = true
    }

    if (!discoverable || objectState.discovered === true) {
      entries.push(name)
    }
  }

  entries.push(...room.exits.map((exit) => exit.label))
  return entries
}
