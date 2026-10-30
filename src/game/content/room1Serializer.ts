import type { RoomObjectConfig } from './room1.ts'

/**
 * Serializes an array of RoomObjectConfig items into valid TypeScript source code
 * suitable for writing directly to src/game/content/room1.ts.
 */
export function generateRoom1Source(objects: RoomObjectConfig[]): string {
  const serializedObjects = objects.map((obj) => {
    const lines = [
      `    id: ${JSON.stringify(obj.id)},`,
      `    role: ${JSON.stringify(obj.role)},`,
      `    x: ${Math.round(obj.x)},`,
      `    y: ${Math.round(obj.y)},`,
      `    displayWidth: ${Math.round(obj.displayWidth)},`,
      `    displayHeight: ${Math.round(obj.displayHeight)},`,
    ]
    if (obj.speed !== undefined) {
      lines.push(`    speed: ${obj.speed},`)
    }
    if (obj.maxHealth !== undefined) {
      lines.push(`    maxHealth: ${obj.maxHealth},`)
    }
    return `  {\n${lines.join('\n')}\n  },`
  })

  return `export interface RoomObjectConfig {
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
${serializedObjects.join('\n')}
]
`
}

