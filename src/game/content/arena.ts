import { wallFromEdges } from '../domain/Room.ts'
import { BOSS_CONFIG } from './bossConstants.ts'
import { ROOM_IDS } from './roomConstants.ts'
import { boss, boulder, dagger, type RoomDefinition } from './roomPieces.ts'

export const ARENA_IDS = {
  room: 'arena',
  boss: 'blademaster',
} as const

/**
 * The last room, played after room: a Boss that chases, fans out Blades and dashes. Two pillars and a boulder are
 * cover from the Blades and the dash. Defeating the Boss opens the Exit at the right wall, which ends the game.
 */
export const ARENA_DEFINITION: RoomDefinition = {
  id: ARENA_IDS.room,
  goal: 'Defeat the blademaster, then walk into the exit.',
  walls: [wallFromEdges(760, 200, 840, 280), wallFromEdges(760, 520, 840, 600)],
  objects: [
    dagger('arenadagger', 360, 600),
    boulder('arenaboulder', 1000, 400),
    boss(ARENA_IDS.boss, 1500, 365, { maxHealth: BOSS_CONFIG.maxHealth }),
  ],
  exit: {
    targetRoomId: ROOM_IDS.end,
    label: ROOM_IDS.end,
    requires: { kind: 'defeat', objectIds: [ARENA_IDS.boss] },
    endsGame: true,
  },
}
