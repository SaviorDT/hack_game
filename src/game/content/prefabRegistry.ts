import type { RoomObjectConfig } from './room.ts'
import {
  DEFAULT_PREFABS,
  type PrefabDefinition,
  applyPrefabToObject,
  inferPrefabId,
} from '../domain/Prefab.ts'
import { generatePrefabSource } from '../domain/prefabSerializer.ts'
import {
  getEditorRoomIds,
  getRoomObjectConfigs,
  setRoomObjectConfigs,
} from './roomRegistry.ts'

export interface PropagationResult {
  prefabId: string
  affectedRooms: string[]
  affectedInstanceCount: number
  objectIds: string[]
}

export interface PrefabInstanceMatch {
  roomId: string
  object: RoomObjectConfig
}

let activePrefabs: PrefabDefinition[] = DEFAULT_PREFABS.map((p) => ({ ...p }))

export function getAllPrefabs(): readonly PrefabDefinition[] {
  return activePrefabs
}

export function getPrefab(id: string): PrefabDefinition | undefined {
  return activePrefabs.find((p) => p.id === id)
}

export function registerPrefab(prefab: PrefabDefinition): void {
  const existingIdx = activePrefabs.findIndex((p) => p.id === prefab.id)
  if (existingIdx !== -1) {
    activePrefabs[existingIdx] = { ...prefab }
  } else {
    activePrefabs.push({ ...prefab })
  }
}

export function updatePrefab(
  id: string,
  updates: Partial<PrefabDefinition>,
): PrefabDefinition {
  const existingIdx = activePrefabs.findIndex((p) => p.id === id)
  if (existingIdx === -1) {
    throw new Error(`Prefab "${id}" not found`)
  }
  const current = activePrefabs[existingIdx]
  const updated: PrefabDefinition = { ...current, ...updates, id }
  activePrefabs[existingIdx] = updated
  return updated
}

export function resetPrefabs(): void {
  activePrefabs = DEFAULT_PREFABS.map((p) => ({ ...p }))
}

/**
 * Finds all instances of a given prefab across all game rooms.
 */
export function getPrefabInstances(prefabId: string): PrefabInstanceMatch[] {
  const matches: PrefabInstanceMatch[] = []
  const roomIds = getEditorRoomIds()

  for (const roomId of roomIds) {
    const objects = getRoomObjectConfigs(roomId)
    for (const obj of objects) {
      if (inferPrefabId(obj) === prefabId) {
        matches.push({ roomId, object: obj })
      }
    }
  }

  return matches
}

/**
 * Propagates prefab modifications to all matching instances across all rooms.
 */
export function propagatePrefabChanges(
  prefabId: string,
  updatedPrefab: PrefabDefinition,
): PropagationResult {
  const roomIds = getEditorRoomIds()
  const affectedRooms: string[] = []
  const objectIds: string[] = []

  for (const roomId of roomIds) {
    const objects = getRoomObjectConfigs(roomId)
    let roomModified = false

    const newObjects = objects.map((obj) => {
      if (inferPrefabId(obj) === prefabId) {
        roomModified = true
        objectIds.push(obj.id)
        return applyPrefabToObject(obj, updatedPrefab)
      }
      return obj
    })

    if (roomModified) {
      affectedRooms.push(roomId)
      setRoomObjectConfigs(roomId, newObjects)
    }
  }

  return {
    prefabId,
    affectedRooms,
    affectedInstanceCount: objectIds.length,
    objectIds,
  }
}

export interface SavePrefabsResult {
  success: boolean
  error?: string
}

/**
 * Serializes active prefabs and persists them directly to src/game/domain/Prefab.ts.
 * Also synchronizes changes across all rooms.
 */
export async function saveActivePrefabs(
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<SavePrefabsResult> {
  const source = generatePrefabSource(activePrefabs)
  try {
    const res = await fetchFn('/api/save-prefabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: source }),
    })
    if (!res.ok) {
      return { success: false, error: `Server returned ${res.status}: ${res.statusText}` }
    }
    const result = (await res.json()) as { success: boolean; error?: string }
    if (!result.success) {
      return { success: false, error: result.error ?? 'Unknown error writing prefabs' }
    }
    for (const prefab of activePrefabs) {
      propagatePrefabChanges(prefab.id, prefab)
    }
    return { success: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { success: false, error }
  }
}
