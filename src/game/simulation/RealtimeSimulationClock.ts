import type { SimulationClock } from './SimulationClock.ts'

// Longest real frame fed to the simulation, so returning to a background tab does not replay seconds of ticks.
export const MAX_FRAME_MS = 250

export class RealtimeSimulationClock implements SimulationClock {
  private timeScale = 1

  toGameDelta(realDeltaMs: number): number {
    return Number.isFinite(realDeltaMs) && realDeltaMs > 0 ? Math.min(realDeltaMs, MAX_FRAME_MS) * this.timeScale : 0
  }

  setTimeScale(timeScale: number): void {
    if (!Number.isFinite(timeScale) || timeScale < 0) {
      throw new Error('Time scale must be a non-negative finite number.')
    }

    this.timeScale = timeScale
  }
}
