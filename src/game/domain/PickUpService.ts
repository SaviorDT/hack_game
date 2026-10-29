import { AabbCollisionWorld } from './CollisionWorld.ts'
import type { CollisionWorld } from './CollisionWorld.ts'
import type { WorldObject } from './WorldObject.ts'
import { getMutableWorldObjectState } from './WorldObjectState.ts'
import type { WorldState } from './WorldState.ts'

export const PICKUP_REACH = 10

interface PositionedState extends Record<string, string | number | boolean | null> {
  x: number
  y: number
  width: number
  height: number
}

interface CollectorState extends PositionedState {
  weaponId: string | null
}

interface WeaponItemState extends PositionedState {
  discovered: boolean
  equippedBy: string | null
}

export type PickUpResult =
  | { readonly status: 'picked-up'; readonly objectId: string }
  | { readonly status: 'nothing-in-reach' }
  | { readonly status: 'already-armed' }

function boxOf(worldObject: WorldObject) {
  const { x, y, width, height } = getMutableWorldObjectState<PositionedState>(worldObject)
  return { x, y, width, height }
}

export class PickUpService {
  private readonly collision: CollisionWorld

  constructor(collision: CollisionWorld = new AabbCollisionWorld()) {
    this.collision = collision
  }

  pickUp(state: WorldState, collectorId: string): PickUpResult {
    const collector = state.worldObjects.find((worldObject) => worldObject.id === collectorId)
    if (!collector) {
      throw new Error(`Unknown collector "${collectorId}".`)
    }

    const collectorState = getMutableWorldObjectState<CollectorState>(collector)
    if (collectorState.weaponId !== null) {
      return { status: 'already-armed' }
    }

    const candidates = state.worldObjects
      .filter(
        (worldObject) =>
          worldObject.roomId === state.currentRoomId &&
          worldObject.metadata.role === 'weapon' &&
          getMutableWorldObjectState<WeaponItemState>(worldObject).equippedBy === null,
      )
      .map((worldObject) => ({ worldObject, box: boxOf(worldObject) }))

    const target = this.collision.nearestWithin(boxOf(collector), candidates, PICKUP_REACH)
    if (!target) {
      return { status: 'nothing-in-reach' }
    }

    const itemState = getMutableWorldObjectState<WeaponItemState>(target.worldObject)
    itemState.equippedBy = collectorId
    itemState.discovered = true
    collectorState.weaponId = String(target.worldObject.metadata.weaponId)
    return { status: 'picked-up', objectId: target.worldObject.id }
  }
}
