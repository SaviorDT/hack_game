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
  scaleX?: number
  scaleY?: number
  speed?: number | PlayerSpeedConfig
  maxHealth?: number
}

export const ROOM1_OBJECTS: RoomObjectConfig[] = [
  {
    id: "player",
    role: "player",
    x: 378,
    y: 345,
    displayWidth: 127,
    displayHeight: 127,
    scaleX: 0.72,
    scaleY: 0.72,
    speed: {
      acceleration: 2500,
      frictionAcceleration: 3000,
      turnaroundAcceleration: 1600,
      maxSpeed: 300,
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
    scaleX: 1,
    scaleY: 1,
  },
  {
    id: "guard",
    role: "guard",
    x: 1490,
    y: 365,
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 210,
    maxHealth: 100,
  },
  {
    id: "guard-2",
    role: "guard",
    x: 1000,
    y: 410,
    displayWidth: 176,
    displayHeight: 176,
    scaleX: 1,
    scaleY: 1,
    speed: 120,
    maxHealth: 100,
  },
  {
    id: "guard-3",
    role: "guard",
    x: 1040,
    y: 440,
    displayWidth: 87,
    displayHeight: 87,
    scaleX: 0.49,
    scaleY: 0.49,
    speed: 120,
    maxHealth: 100,
  },
]
