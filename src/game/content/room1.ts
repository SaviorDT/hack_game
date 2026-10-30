export interface PlayerSpeedConfig {
  acceleration: number
  frictionAcceleration: number
  turnaroundAcceleration: number
  maxSpeed: number
  [key: string]: number
}

export interface RoomObjectConfig {
  id: string
  role: 'player' | 'guard' | 'weapon'
  x: number
  y: number
  displayWidth: number
  displayHeight: number
  speed?: number | PlayerSpeedConfig
  maxHealth?: number
}

export const ROOM1_OBJECTS: RoomObjectConfig[] = [
  {
    id: "player",
    role: "player",
    x: 250,
    y: 205,
    displayWidth: 176,
    displayHeight: 176,
    speed: {
      acceleration: 5000,
      frictionAcceleration: 3000,
      turnaroundAcceleration: 1600,
      maxSpeed: 1000,
    },
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
]
