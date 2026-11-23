import type { Room } from '../domain/Room.ts'
import type { JsonValue } from '../domain/JsonValue.ts'
import type { RoomId, WorldObjectId } from '../domain/ids.ts'
import type { WorldObjectMetadata } from '../domain/WorldObject.ts'
import type { BehaviorRule } from '../processes/BehaviorRule.ts'
import type { ProcessInstance } from '../processes/ProcessInstance.ts'

export interface WorldObjectSnapshot {
  readonly id: WorldObjectId
  readonly roomId: RoomId
  readonly metadata: WorldObjectMetadata
  readonly behaviorRules: readonly BehaviorRule[]
  readonly state: JsonValue
}

export interface WorldStateSnapshot {
  readonly rooms: readonly Room[]
  readonly worldObjects: readonly WorldObjectSnapshot[]
  readonly processInstances: readonly ProcessInstance[]
  readonly currentRoomId: RoomId | null
  readonly commandHistory: readonly string[]
  readonly simulationTick: number
  readonly outcome: 'playing' | 'game-over' | 'congratulations'
}

export interface SaveSnapshot {
  readonly schemaVersion: number
  readonly worldState: WorldStateSnapshot
}
