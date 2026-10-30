export interface ScalableMovableObject {
  id: string
  x: number
  y: number
  displayWidth: number
  displayHeight: number
  baseWidth: number
  baseHeight: number
  scaleX: number
  scaleY: number
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

export type EditorChange = MoveChange | ScaleChange

/**
 * Defines the reverse of any editor change.
 * e.g., move(+dx, +dy) -> move(-dx, -dy)
 *       scale(*factor)  -> scale(*(1 / factor))
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
  }
}

/**
 * Applies a change (either original or reversed) to the target object.
 */
export function applyChange(target: ScalableMovableObject, change: EditorChange): void {
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

