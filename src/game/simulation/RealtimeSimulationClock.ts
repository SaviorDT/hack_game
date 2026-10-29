import type { SimulationClock } from './SimulationClock.ts'

export class RealtimeSimulationClock implements SimulationClock {
  private timeScale = 1

  toGameDelta(realDeltaMs: number): number {
    return Number.isFinite(realDeltaMs) && realDeltaMs > 0 ? realDeltaMs * this.timeScale : 0
  }

  setTimeScale(timeScale: number): void {
    if (!Number.isFinite(timeScale) || timeScale < 0) {
      throw new Error('Time scale must be a non-negative finite number.')
    }

    this.timeScale = timeScale
  }
}
