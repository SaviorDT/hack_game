export interface SimulationClock {
  toGameDelta(realDeltaMs: number): number
  setTimeScale(timeScale: number): void
}
