export interface RoomObjectConfig {
  id: string
  role: 'player' | 'guard' | 'weapon'
  x: number
  y: number
  displayWidth: number
  displayHeight: number
  speed?: number
  maxHealth?: number
}

export const ROOM1_OBJECTS: RoomObjectConfig[] = [
  {
    id: "player",
    role: "player",
    x: 1141,
    y: 326,
    displayWidth: 123,
    displayHeight: 123,
    speed: 240,
    maxHealth: 100,
  },
  {
    id: "dagger",
    role: "weapon",
    x: 325,
    y: 610,
    displayWidth: 72,
    displayHeight: 72,
  },
  {
    id: "guard",
    role: "guard",
    x: 1490,
    y: 365,
    displayWidth: 176,
    displayHeight: 176,
    speed: 210,
    maxHealth: 100,
  },
  {
    id: "guard-2",
    role: "guard",
    x: 1233,
    y: 525,
    displayWidth: 176,
    displayHeight: 176,
    speed: 120,
    maxHealth: 100,
  },
]
