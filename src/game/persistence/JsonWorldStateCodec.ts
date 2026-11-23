import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import type { MutableJsonValue } from '../domain/JsonValue.ts'
import type { WorldState } from '../domain/WorldState.ts'
import type { WorldStateCodec } from './WorldStateCodec.ts'
import type { WorldStateSnapshot } from './SaveSnapshot.ts'

export class JsonWorldStateCodec implements WorldStateCodec {
  serialize(state: WorldState): WorldStateSnapshot {
    return {
      rooms: structuredClone(state.rooms),
      worldObjects: state.worldObjects.map((worldObject) => ({
        id: worldObject.id,
        roomId: worldObject.roomId,
        metadata: structuredClone(worldObject.metadata),
        behaviorRules: structuredClone(worldObject.behaviorRules),
        state: structuredClone(worldObject.state),
      })),
      processInstances: structuredClone(state.processInstances),
      currentRoomId: state.currentRoomId,
      commandHistory: [...state.commandHistory],
      simulationTick: state.simulationTick,
      outcome: state.outcome,
    }
  }

  hydrate(snapshot: WorldStateSnapshot): WorldState {
    return {
      rooms: [...structuredClone(snapshot.rooms)],
      worldObjects: snapshot.worldObjects.map(
        (worldObject) =>
          new BasicWorldObject(
            worldObject.id,
            worldObject.roomId,
            structuredClone(worldObject.metadata),
            structuredClone(worldObject.behaviorRules),
            structuredClone(worldObject.state) as MutableJsonValue,
          ),
      ),
      processInstances: [...structuredClone(snapshot.processInstances)],
      currentRoomId: snapshot.currentRoomId,
      commandHistory: [...snapshot.commandHistory],
      simulationTick: snapshot.simulationTick ?? 0,
      outcome: snapshot.outcome ?? 'playing',
    }
  }
}
