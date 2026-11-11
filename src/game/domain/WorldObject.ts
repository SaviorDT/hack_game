import type { BehaviorRule } from '../processes/BehaviorRule.ts'
import type { JsonValue, MutableJsonValue } from './JsonValue.ts'
import type { RoomId, WorldObjectId } from './ids.ts'
import { assertValidLabel } from './label.ts'

export type WorldObjectMetadata = Record<string, JsonValue>

export abstract class WorldObject {
  readonly id: WorldObjectId
  /** The Room the object is in. Only room travel changes it (see `RoomTravel.ts`). */
  roomId: RoomId
  metadata: WorldObjectMetadata
  readonly behaviorRules: readonly BehaviorRule[]
  public state: MutableJsonValue

  protected constructor(
    id: WorldObjectId,
    roomId: RoomId,
    metadata: WorldObjectMetadata,
    behaviorRules: readonly BehaviorRule[],
    state: MutableJsonValue,
  ) {
    assertValidLabel(id, 'world object id')
    if (typeof metadata.name === 'string') {
      assertValidLabel(metadata.name, 'world object name')
    }
    this.id = id
    this.roomId = roomId
    this.metadata = metadata
    this.behaviorRules = behaviorRules
    this.state = state
  }

  rename(newName: string): void {
    assertValidLabel(newName, 'world object name')
    this.metadata = {
      ...this.metadata,
      name: newName,
    }
  }
}
