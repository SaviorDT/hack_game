export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Bounds {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface CollisionWorld {
  gap(a: Box, b: Box): number
  clampToBounds(box: Box, bounds: Bounds): { x: number; y: number }
  nearestWithin<T extends { readonly box: Box }>(
    origin: Box,
    candidates: readonly T[],
    maxGap: number,
  ): T | undefined
}

export class AabbCollisionWorld implements CollisionWorld {
  gap(a: Box, b: Box): number {
    const gapX = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2)
    const gapY = Math.max(0, Math.abs(a.y - b.y) - (a.height + b.height) / 2)
    return Math.hypot(gapX, gapY)
  }

  clampToBounds(box: Box, bounds: Bounds): { x: number; y: number } {
    return {
      x: Math.min(Math.max(box.x, bounds.left + box.width / 2), bounds.right - box.width / 2),
      y: Math.min(Math.max(box.y, bounds.top + box.height / 2), bounds.bottom - box.height / 2),
    }
  }

  nearestWithin<T extends { readonly box: Box }>(
    origin: Box,
    candidates: readonly T[],
    maxGap: number,
  ): T | undefined {
    let nearest: T | undefined
    let nearestGap = Infinity
    for (const candidate of candidates) {
      const candidateGap = this.gap(origin, candidate.box)
      if (candidateGap <= maxGap && candidateGap < nearestGap) {
        nearest = candidate
        nearestGap = candidateGap
      }
    }
    return nearest
  }
}
