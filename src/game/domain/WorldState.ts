import type { CommandHistory } from '../commands/CommandHistory.ts'
import type { ProcessInstance } from '../processes/ProcessInstance.ts'
import type { CommandSlotMap } from '../application/commandSlots.ts'
import type { Room } from './Room.ts'
import type { RoomId } from './ids.ts'
import type { WorldObject } from './WorldObject.ts'

export interface WorldState {
  rooms: Room[]
  worldObjects: WorldObject[]
  processInstances: ProcessInstance[]
  currentRoomId: RoomId | null
  commandHistory: CommandHistory
  commandSlots?: CommandSlotMap
  simulationTick: number
  outcome: 'playing' | 'game-over' | 'congratulations'
}
