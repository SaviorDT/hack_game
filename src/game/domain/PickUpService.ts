import { ShapeCollisionWorld, boxFromState } from './CollisionWorld.ts'
import type { CollisionWorld } from './CollisionWorld.ts'
import { isDestroyed } from './MvLimit.ts'
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
  return boxFromState(getMutableWorldObjectState<PositionedState>(worldObject))
}

export class PickUpService {
  private readonly collision: CollisionWorld

  constructor(collision: CollisionWorld = new ShapeCollisionWorld()) {
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
          !getMutableWorldObjectState<WeaponItemState>(worldObject).equippedBy &&
          !isDestroyed(worldObject),
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
    const itemRecord = itemState as unknown as Record<string, unknown>
    itemRecord.thrown = null
    itemRecord.vx = 0
    itemRecord.vy = 0
    const weaponId =
      target.worldObject.metadata.weaponId ??
      (target.worldObject.metadata.role === 'weapon' ? target.worldObject.id : null)
    if (weaponId) {
      collectorState.weaponId = String(weaponId)
    }
    return { status: 'picked-up', objectId: target.worldObject.id }
  }

  unequip(state: WorldState, objectId: string): void {
    const object = state.worldObjects.find((worldObject) => worldObject.id === objectId)
    if (!object) {
      return
    }

    const itemState = getMutableWorldObjectState<WeaponItemState>(object)
    if (!itemState.equippedBy) {
      return
    }

    const holder = state.worldObjects.find((worldObject) => worldObject.id === itemState.equippedBy)
    if (holder) {
      const holderState = getMutableWorldObjectState<CollectorState>(holder)
      const weaponId =
        object.metadata.weaponId ??
        (object.metadata.role === 'weapon' ? object.id : null)
      if (holderState.weaponId === String(weaponId) || holderState.weaponId === object.id) {
        holderState.weaponId = null
      }
    }
    itemState.equippedBy = null
  }

  unequipIfOutOfReach(state: WorldState, objectId: string): boolean {
    const object = state.worldObjects.find((worldObject) => worldObject.id === objectId)
    if (!object) {
      return false
    }

    const itemState = getMutableWorldObjectState<WeaponItemState>(object)
    if (!itemState.equippedBy) {
      return false
    }

    const holder = state.worldObjects.find((worldObject) => worldObject.id === itemState.equippedBy)
    if (!holder) {
      itemState.equippedBy = null
      return true
    }

    if (this.collision.gap(boxOf(holder), boxOf(object)) > PICKUP_REACH) {
      const holderState = getMutableWorldObjectState<CollectorState>(holder)
      const weaponId =
        object.metadata.weaponId ??
        (object.metadata.role === 'weapon' ? object.id : null)
      if (holderState.weaponId === String(weaponId) || holderState.weaponId === object.id) {
        holderState.weaponId = null
      }
      itemState.equippedBy = null
      return true
    }

    return false
  }
}
