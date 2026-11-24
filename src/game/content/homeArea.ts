import { wallFromEdges } from '../domain/Room.ts'
import { TUTORIAL_ROOM_IDS } from './tutorialRoomIds.ts'
import { archer, boulder, crate, dagger, guard, plate, type RoomDefinition } from './roomPieces.ts'

/**
 * The first area after the tutorial, played before room. The only hint banner is yard's, which names the R and Space shortcuts: each room poses one
 * problem that its layout makes solvable, and the last combines them.
 *
 * storage → yard → lane → gate → wheel → room
 */
export const YARD_HINT = 'Stuck? Press R to reset the room, or press SPACE to open the menu.'

export const HOME_AREA_IDS = {
  storage: 'storage',
  yard: 'yard',
  lane: 'lane',
  gate: 'gate',
} as const

export const HOME_AREA_ROOMS: RoomDefinition[] = [
  {
    // The exit needs the plate held down. Standing on it works, but then nobody can walk out: a crate must stay on it.
    id: HOME_AREA_IDS.storage,
    goal: 'The way on is shut tight.',
    walls: [wallFromEdges(1100, 80, 1160, 330), wallFromEdges(560, 470, 900, 520)],
    objects: [crate('storagecrate', 520, 260), crate('storagecrate2', 760, 600, 'crate2'), plate('storageplate', 1500, 560)],
    exit: {
      targetRoomId: HOME_AREA_IDS.yard,
      label: HOME_AREA_IDS.yard,
      requires: { kind: 'pressed', plateIds: ['storageplate'] },
    },
  },
  {
    // An archer across a yard of stone pillars: move from cover to cover, then take it down.
    id: HOME_AREA_IDS.yard,
    hint: YARD_HINT,
    goal: 'Deal with the archer.',
    walls: [
      wallFromEdges(620, 220, 700, 300),
      wallFromEdges(620, 520, 700, 600),
      wallFromEdges(980, 370, 1060, 450),
      wallFromEdges(1300, 220, 1380, 300),
      wallFromEdges(1300, 520, 1380, 600),
    ],
    objects: [dagger('yarddagger', 430, 600), crate('yardcrate', 830, 420), archer('yardarcher', 1620, 420)],
    exit: {
      targetRoomId: HOME_AREA_IDS.lane,
      label: HOME_AREA_IDS.lane,
      requires: { kind: 'defeat', objectIds: ['yardarcher'] },
    },
  },
  {
    // An archer sealed in a booth shoots through a narrow window over the plate. The only weight in reach is the
    // boulder, and `acc boulder plate` both opens the exit and plugs the window.
    id: HOME_AREA_IDS.lane,
    goal: 'The way on is shut tight, and the archer has the plate covered.',
    walls: [
      wallFromEdges(1380, 80, 1420, 270),
      wallFromEdges(1380, 230, 1470, 270),
      wallFromEdges(1540, 230, 1824, 270),
    ],
    objects: [
      boulder('laneboulder', 450, 580),
      plate('laneplate', 1505, 345),
      archer('lanearcher', 1505, 155, { displayWidth: 106, displayHeight: 106, scaleX: 0.6, scaleY: 0.6, colliderWidth: 66, colliderHeight: 96 }),
    ],
    exit: {
      targetRoomId: HOME_AREA_IDS.gate,
      label: HOME_AREA_IDS.gate,
      requires: { kind: 'pressed', plateIds: ['laneplate'] },
    },
  },
  {
    // Everything at once: two guards charge, an archer covers the far end, and the exit needs the plate held down.
    id: HOME_AREA_IDS.gate,
    goal: 'Hold the plate down and defeat the guards.',
    walls: [
      wallFromEdges(700, 200, 760, 340),
      wallFromEdges(700, 500, 760, 640),
      // Cover from the archer on the guards' side of the room: fight from its lower left.
      wallFromEdges(1230, 360, 1340, 470),
    ],
    objects: [
      dagger('gatedagger', 370, 600),
      crate('gatecrate', 560, 420),
      boulder('gateboulder', 570, 630),
      plate('gateplate', 1560, 600),
      // Different speeds, so the guards arrive one after the other rather than together.
      guard('gateguard', 1450, 300, { speed: 190, maxHealth: 60 }),
      guard('gateguard_b', 1480, 470, { name: 'guard_b', speed: 120, maxHealth: 60 }),
      archer('gatearcher', 1700, 200),
    ],
    exit: {
      targetRoomId: TUTORIAL_ROOM_IDS.flyAround,
      label: TUTORIAL_ROOM_IDS.flyAround,
      requires: [
        { kind: 'pressed', plateIds: ['gateplate'] },
        { kind: 'defeat', objectIds: ['gateguard', 'gateguard_b'] },
      ],
    },
  },
]
