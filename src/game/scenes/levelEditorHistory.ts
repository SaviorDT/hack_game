import type { PhysicsAttrConfig, PlayerSpeedConfig, WorldObjectRole } from '../content/room.ts'
import type { ObjectKind } from '../domain/ObjectKind.ts'
import { GAME_WEAPON_CONFIG } from '../content/weaponConstants.ts'
import { computeCollisionSize } from '../content/roomWorldState.ts'
import { rolesCollide } from '../domain/ColliderTag.ts'
import { ShapeCollisionWorld, type ColliderShape } from '../domain/CollisionWorld.ts'

const editorCollision = new ShapeCollisionWorld()

/** Collider size as the editor draws and checks it: a circle is a square whose side is its diameter (the width). */
/** Pressure plates and Target Dummies are never in the way: nothing Collides with them. */
export function passesThrough(kind: string | undefined): boolean {
  return kind === 'plate' || kind === 'dummy'
}

export function computeEditorColliderSize(
  role: WorldObjectRole,
  scaleX: number,
  scaleY: number,
  colliderWidth?: number,
  colliderHeight?: number,
  colliderShape?: ColliderShape,
): { width: number; height: number } {
  const size = computeCollisionSize(role, scaleX, scaleY, colliderWidth, colliderHeight)
  return colliderShape === 'circle' ? { width: size.width, height: size.width } : size
}

export function computeEditorCollisionBox(
  role: WorldObjectRole,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  colliderWidth?: number,
  colliderHeight?: number,
): { x: number; y: number; width: number; height: number } | null {
  if (role === 'weapon') return null
  const size = computeCollisionSize(role, scaleX, scaleY, colliderWidth, colliderHeight)
  return { x, y, width: size.width, height: size.height }
}

export function wouldOverlapAnyEditorObject(
  objectId: string,
  targetRole: WorldObjectRole,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  allObjects: readonly {
    id: string
    role: WorldObjectRole
    x: number
    y: number
    scaleX: number
    scaleY: number
    colliderWidth?: number
    colliderHeight?: number
    colliderShape?: ColliderShape
    kind?: string
  }[],
  colliderWidth?: number,
  colliderHeight?: number,
  colliderShape?: ColliderShape,
  targetKind?: string,
): boolean {
  if (passesThrough(targetKind)) return false
  const targetSize = computeEditorColliderSize(targetRole, scaleX, scaleY, colliderWidth, colliderHeight, colliderShape)
  const target = { x, y, ...targetSize, shape: colliderShape }

  for (const other of allObjects) {
    if (other.id === objectId || passesThrough(other.kind) || !rolesCollide(targetRole, other.role)) continue
    const otherSize = computeEditorColliderSize(
      other.role,
      other.scaleX,
      other.scaleY,
      other.colliderWidth,
      other.colliderHeight,
      other.colliderShape,
    )
    if (editorCollision.overlaps(target, { x: other.x, y: other.y, ...otherSize, shape: other.colliderShape })) {
      return true
    }
  }
  return false
}

/**
 * Generates the next object ID using the `<name><num>` pattern for multi-instances
 * (e.g., guard, guard2, guard3; dagger, dagger2; boulder, boulder2).
 */
export function generateNextObjectId(
  role: WorldObjectRole,
  existing: readonly ({ id: string } | string)[],
  customPrefix?: string,
): string {
  const prefix =
    customPrefix ??
    (role === 'weapon'
      ? 'dagger'
      : role === 'object'
        ? 'boulder'
        : role === 'enemy' || role === 'guard'
          ? 'guard'
          : role)
  const existingIds = new Set(existing.map((item) => (typeof item === 'string' ? item : item.id)))
  if (!existingIds.has(prefix)) {
    return prefix
  }
  let counter = 2
  while (existingIds.has(`${prefix}${counter}`)) {
    counter++
  }
  return `${prefix}${counter}`
}

export interface ScalableMovableObject {
  id: string
  name?: string
  kind?: ObjectKind
  passive?: boolean
  mvLimit?: number
  strikeDamage?: number
  x: number
  y: number
  displayWidth: number
  displayHeight: number
  baseWidth: number
  baseHeight: number
  scaleX: number
  scaleY: number
  colliderWidth?: number
  colliderHeight?: number
  colliderShape?: ColliderShape
  maxHealth?: number
  speed?: number | PlayerSpeedConfig
  maxSpeed?: number
  acceleration?: number
  frictionAcceleration?: number
  turnaroundAcceleration?: number
  attackDistance?: number
  attackDurationMs?: number
  holdOffsetX?: number
  holdOffsetY?: number
  drag?: number
  mass?: number
  max_velocity?: number
  restitution?: number
  friction?: number
}

export interface MoveChange {
  readonly type: 'move'
  readonly objectId: string
  readonly dx: number
  readonly dy: number
  readonly prevX?: number
  readonly prevY?: number
  readonly nextX?: number
  readonly nextY?: number
}

export interface ScaleChange {
  readonly type: 'scale'
  readonly objectId: string
  readonly factor: number
  readonly prevScaleX?: number
  readonly prevScaleY?: number
  readonly prevDisplayWidth?: number
  readonly prevDisplayHeight?: number
  readonly nextScaleX?: number
  readonly nextScaleY?: number
  readonly nextDisplayWidth?: number
  readonly nextDisplayHeight?: number
}

export type CharacterProperty =
  | 'maxHealth'
  | 'speed'
  | 'strikeDamage'
  | 'maxSpeed'
  | 'acceleration'
  | 'frictionAcceleration'
  | 'turnaroundAcceleration'
  | 'attackDistance'
  | 'attackDurationMs'
  | 'holdOffsetX'
  | 'holdOffsetY'
  | 'colliderWidth'
  | 'colliderHeight'

export interface PropertyChange {
  readonly type: 'property'
  readonly objectId: string
  readonly property: CharacterProperty
  readonly delta: number
  readonly prevValue: number
  readonly nextValue: number
}

export interface ColliderChange {
  readonly type: 'collider'
  readonly objectId: string
  readonly prevWidth: number
  readonly prevHeight: number
  readonly nextWidth: number
  readonly nextHeight: number
}

export type PhysicsAttrKey = keyof PhysicsAttrConfig

/** Sets or clears (undefined) one per-object physics value; a cleared value falls back to the global default. */
export function setPhysicsAttrValue(
  target: ScalableMovableObject,
  key: PhysicsAttrKey,
  value: number | undefined,
): void {
  if (value === undefined) {
    delete target[key]
  } else {
    target[key] = value
  }
}

export interface PhysicsAttrChange {
  readonly type: 'physics_attr'
  readonly objectId: string
  readonly key: PhysicsAttrKey
  /** undefined means "no override, use the global default". */
  readonly prevValue: number | undefined
  readonly nextValue: number | undefined
}

export interface SpawnChange {
  readonly type: 'spawn'
  readonly objectId: string
  readonly role: WorldObjectRole
  readonly snapshot: ScalableMovableObject
}

export interface DespawnChange {
  readonly type: 'despawn'
  readonly objectId: string
  readonly role: WorldObjectRole
  readonly snapshot: ScalableMovableObject
}

export type EditorChange =
  | MoveChange
  | ScaleChange
  | PropertyChange
  | ColliderChange
  | PhysicsAttrChange
  | SpawnChange
  | DespawnChange

/**
 * Defines the reverse of any editor change.
 * e.g., move(+dx, +dy) -> move(-dx, -dy)
 *       scale(*factor)  -> scale(*(1 / factor))
 *       property(+delta)-> property(-delta)
 *       spawn           -> despawn
 *       despawn         -> spawn
 */
export function invertChange(change: EditorChange): EditorChange {
  switch (change.type) {
    case 'move':
      return {
        type: 'move',
        objectId: change.objectId,
        dx: -change.dx,
        dy: -change.dy,
        prevX: change.nextX,
        prevY: change.nextY,
        nextX: change.prevX,
        nextY: change.prevY,
      }
    case 'scale':
      return {
        type: 'scale',
        objectId: change.objectId,
        factor: change.factor !== 0 ? 1 / change.factor : 1,
        prevScaleX: change.nextScaleX,
        prevScaleY: change.nextScaleY,
        prevDisplayWidth: change.nextDisplayWidth,
        prevDisplayHeight: change.nextDisplayHeight,
        nextScaleX: change.prevScaleX,
        nextScaleY: change.prevScaleY,
        nextDisplayWidth: change.prevDisplayWidth,
        nextDisplayHeight: change.prevDisplayHeight,
      }
    case 'property':
      return {
        type: 'property',
        objectId: change.objectId,
        property: change.property,
        delta: -change.delta,
        prevValue: change.nextValue,
        nextValue: change.prevValue,
      }
    case 'collider':
      return {
        type: 'collider',
        objectId: change.objectId,
        prevWidth: change.nextWidth,
        prevHeight: change.nextHeight,
        nextWidth: change.prevWidth,
        nextHeight: change.prevHeight,
      }
    case 'physics_attr':
      return {
        type: 'physics_attr',
        objectId: change.objectId,
        key: change.key,
        prevValue: change.nextValue,
        nextValue: change.prevValue,
      }
    case 'spawn':
      return {
        type: 'despawn',
        objectId: change.objectId,
        role: change.role,
        snapshot: change.snapshot,
      }
    case 'despawn':
      return {
        type: 'spawn',
        objectId: change.objectId,
        role: change.role,
        snapshot: change.snapshot,
      }
  }
}

/**
 * Applies a change (either original or reversed) to the target object.
 */
export function applyChange(target: ScalableMovableObject, change: EditorChange): void {
  if (change.type === 'spawn' || change.type === 'despawn') {
    return
  }

  if (target.id !== change.objectId) {
    throw new Error(
      `Target object id "${target.id}" does not match change object id "${change.objectId}"`,
    )
  }

  switch (change.type) {
    case 'move': {
      if (change.nextX !== undefined && change.nextY !== undefined) {
        target.x = change.nextX
        target.y = change.nextY
      } else {
        target.x += change.dx
        target.y += change.dy
      }
      break
    }
    case 'scale': {
      if (
        change.nextScaleX !== undefined &&
        change.nextScaleY !== undefined &&
        change.nextDisplayWidth !== undefined &&
        change.nextDisplayHeight !== undefined
      ) {
        target.scaleX = change.nextScaleX
        target.scaleY = change.nextScaleY
        target.displayWidth = change.nextDisplayWidth
        target.displayHeight = change.nextDisplayHeight
      } else {
        target.scaleX *= change.factor
        target.scaleY *= change.factor
        target.displayWidth = Math.max(16, Math.round(target.baseWidth * target.scaleX))
        target.displayHeight = Math.max(16, Math.round(target.baseHeight * target.scaleY))
      }
      break
    }
    case 'property': {
      target[change.property] = change.nextValue
      if (typeof target.speed === 'object' && target.speed !== null) {
        if (change.property === 'maxSpeed') target.speed.maxSpeed = change.nextValue
        if (change.property === 'acceleration') target.speed.acceleration = change.nextValue
        if (change.property === 'frictionAcceleration') target.speed.frictionAcceleration = change.nextValue
        if (change.property === 'turnaroundAcceleration') target.speed.turnaroundAcceleration = change.nextValue
      }
      if (change.property === 'attackDistance') GAME_WEAPON_CONFIG.attackDistance = change.nextValue
      if (change.property === 'attackDurationMs') GAME_WEAPON_CONFIG.attackDurationMs = change.nextValue
      if (change.property === 'holdOffsetX') GAME_WEAPON_CONFIG.holdOffsetX = change.nextValue
      if (change.property === 'holdOffsetY') GAME_WEAPON_CONFIG.holdOffsetY = change.nextValue
      if (change.property === 'colliderWidth') target.colliderWidth = change.nextValue
      if (change.property === 'colliderHeight') target.colliderHeight = change.nextValue
      break
    }
    case 'physics_attr': {
      setPhysicsAttrValue(target, change.key, change.nextValue)
      break
    }
    case 'collider': {
      target.colliderWidth = change.nextWidth
      target.colliderHeight = change.nextHeight
      break
    }
  }
}

export class EditorHistory {
  private undoStack: EditorChange[] = []
  private readonly maxDepth: number

  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth
  }

  push(change: EditorChange): void {
    this.undoStack.push(change)
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift()
    }
  }

  /**
   * Undoes the most recent change by calculating its reverse definition
   * and applying that reverse change to the target object.
   */
  undo(findTarget: (id: string) => ScalableMovableObject | undefined): EditorChange | undefined {
    const change = this.undoStack.pop()
    if (!change) {
      return undefined
    }

    const reverse = invertChange(change)
    const target = findTarget(reverse.objectId)
    if (target) {
      applyChange(target, reverse)
    }
    return reverse
  }

  clear(): void {
    this.undoStack = []
  }

  get depth(): number {
    return this.undoStack.length
  }
}

