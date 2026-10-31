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
    const candidates = state.worldObjects
      .filter(
        (worldObject) =>
          worldObject.roomId === state.currentRoomId &&
          (worldObject.metadata.role === 'weapon' ||
            worldObject.metadata.role === 'item' ||
            Boolean(worldObject.metadata.pickUpAble)) &&
          !getMutableWorldObjectState<WeaponItemState>(worldObject).equippedBy,
      )
      .map((worldObject) => ({ worldObject, box: boxOf(worldObject) }))

    const target = this.collision.nearestWithin(boxOf(collector), candidates, PICKUP_REACH)
    if (!target) {
      return { status: 'nothing-in-reach' }
    }

    const isWeapon =
      target.worldObject.metadata.role === 'weapon' ||
      Boolean(target.worldObject.metadata.weaponId)
    if (isWeapon && collectorState.weaponId !== null) {
      return { status: 'already-armed' }
    }

    const itemState = getMutableWorldObjectState<WeaponItemState>(target.worldObject)
    itemState.equippedBy = collectorId
    itemState.discovered = true
    const weaponId =
      target.worldObject.metadata.weaponId ??
      (target.worldObject.metadata.role === 'weapon' ? target.worldObject.id : null)
    if (weaponId) {
      collectorState.weaponId = String(weaponId)
    }
    return { status: 'picked-up', objectId: target.worldObject.id }
  }
}
