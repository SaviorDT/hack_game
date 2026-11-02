import type { CharacterState } from './CharacterState.ts'
import { getMutableWorldObjectState } from './WorldObjectState.ts'
import type { WorldState } from './WorldState.ts'

export interface PlayerMotionState extends CharacterState {
  moveX: number
  moveY: number
  vx: number
  vy: number
}

/** Ends the game when the Player Character has been defeated, whatever defeated it. */
export function applyPlayerDefeat(state: WorldState): void {
  if (state.outcome !== 'playing') {
    return
  }
  const player = state.worldObjects.find((worldObject) => worldObject.metadata.role === 'player')
  if (!player) {
    return
  }
  const playerState = getMutableWorldObjectState<PlayerMotionState>(player)
  if (playerState.alive) {
    return
  }
  playerState.moveX = 0
  playerState.moveY = 0
  playerState.vx = 0
  playerState.vy = 0
  state.outcome = 'game-over'
}
