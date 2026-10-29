import type { WorldState } from '../domain/WorldState.ts'

export interface RenderPosition {
  readonly x: number
  readonly y: number
}

export interface SimulationEngine {
  advance(state: WorldState, gameDeltaMs: number): void
  // Position to draw this frame: blended between the last two ticks so motion stays smooth
  // whatever the frame rate or Time Scale. Undefined when the object has no coordinates.
  renderPosition(state: WorldState, objectId: string): RenderPosition | undefined
}
