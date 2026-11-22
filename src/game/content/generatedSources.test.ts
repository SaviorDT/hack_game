import { describe, expect, expectTypeOf, it } from 'vitest'
import { generateCommandModeConstantsSource } from '../commands/commandModeSerializer.ts'
import { GAME_MV_CONFIG } from '../commands/mvConstants.ts'
import { generateMvConstantsSource } from '../commands/mvSerializer.ts'
import { DEFAULT_PREFABS } from '../domain/Prefab.ts'
import type { ObjectKind } from '../domain/ObjectKind.ts'
import { generatePrefabSource } from '../domain/prefabSerializer.ts'
import { GAME_PHYSICS_CONFIG } from '../simulation/physicsConstants.ts'
import { generatePhysicsConstantsSource } from '../simulation/physicsSerializer.ts'
import { ROOM1_OBJECTS, type RoomObjectConfig } from './room1.ts'
import { generateRoom1Source } from './room1Serializer.ts'

/**
 * The editors save by overwriting whole source files from a template (`room1.ts`, `Prefab.ts`,
 * `physicsConstants.ts`, `mvConstants.ts`, `commandModeConstants.ts`). Anything another module imports from one
 * of them that the template does not write breaks the whole game the next time the editor saves.
 */
const GENERATED = [
  { module: 'room1', source: () => generateRoom1Source(ROOM1_OBJECTS) },
  { module: 'Prefab', source: () => generatePrefabSource(DEFAULT_PREFABS) },
  { module: 'physicsConstants', source: () => generatePhysicsConstantsSource(GAME_PHYSICS_CONFIG) },
  { module: 'mvConstants', source: () => generateMvConstantsSource({ ...GAME_MV_CONFIG, commandTimeScale: 0.25 } as never) },
  { module: 'commandModeConstants', source: () => generateCommandModeConstantsSource({ commandTimeScale: 0.25 }) },
] as const

/** Every source file of the game as text, keyed by path (`/src/...`). */
const SOURCES = import.meta.glob<string>('/src/**/*.ts', { query: '?raw', import: 'default', eager: true })

function importedNames(module: string): { name: string; file: string }[] {
  const pattern = new RegExp(`import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+'[^']*/${module}\\.ts'`, 'g')
  return Object.entries(SOURCES).flatMap(([file, text]) =>
    [...text.matchAll(pattern)].flatMap((match) =>
      match[1]
        .split(',')
        .map((part) => part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0])
        .filter((name) => name.length > 0)
        .map((name) => ({ name, file })),
    ),
  )
}

describe('generated source files', () => {
  for (const { module, source } of GENERATED) {
    it(`${module}.ts is still written with every name other modules import from it`, () => {
      const written = source()
      const imports = importedNames(module)
      expect(imports.length).toBeGreaterThan(0)
      for (const { name, file } of imports) {
        const exported = new RegExp(`export\\s+(?:declare\\s+)?(?:const|let|function|interface|type|class)\\s+${name}\\b`)
        expect(exported.test(written), `${file} imports "${name}" from ${module}.ts, which the editor save does not write`).toBe(true)
      }
    })
  }

  it('keeps the kinds in the generated RoomObjectConfig equal to ObjectKind', () => {
    expectTypeOf<NonNullable<RoomObjectConfig['kind']>>().toEqualTypeOf<ObjectKind>()
  })
})
