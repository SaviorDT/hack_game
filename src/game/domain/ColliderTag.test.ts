import { describe, expect, it } from 'vitest'
import { BasicWorldObject } from './BasicWorldObject.ts'
import { collidesPhysically, colliderTagsOf, defaultColliderTags, isSolidTagged, rolesCollide } from './ColliderTag.ts'

function objectWithRole(role: 'player' | 'enemy' | 'weapon' | 'object', alive?: boolean) {
  return new BasicWorldObject(
    role,
    'room',
    { name: role, role, colliderTags: defaultColliderTags(role) },
    [],
    { x: 0, y: 0, width: 10, height: 10, ...(alive === undefined ? {} : { alive }) },
  )
}

describe('collidesPhysically', () => {
  const player = objectWithRole('player')
  const guard = objectWithRole('enemy')
  const dagger = objectWithRole('weapon')
  const boulder = objectWithRole('object')

  it('makes Characters collide with Characters and Obstacles', () => {
    expect(collidesPhysically(player, guard)).toBe(true)
    expect(collidesPhysically(player, boulder)).toBe(true)
    expect(collidesPhysically(boulder, guard)).toBe(true)
  })

  it('makes Obstacles collide with Obstacles and Weapons', () => {
    expect(collidesPhysically(boulder, objectWithRole('object'))).toBe(true)
    expect(collidesPhysically(dagger, boulder)).toBe(true)
    expect(collidesPhysically(boulder, dagger)).toBe(true)
  })

  it('lets Weapons pass through Characters and other Weapons', () => {
    expect(collidesPhysically(dagger, player)).toBe(false)
    expect(collidesPhysically(guard, dagger)).toBe(false)
    expect(collidesPhysically(dagger, objectWithRole('weapon'))).toBe(false)
  })

  it('does not collide with an object that carries no tag', () => {
    const untagged = new BasicWorldObject('x', 'room', { name: 'x', role: 'object' }, [], { x: 0, y: 0 })
    expect(collidesPhysically(untagged, player)).toBe(false)
  })
})

describe('rolesCollide', () => {
  it('answers like collidesPhysically for objects built from those roles', () => {
    expect(rolesCollide('player', 'enemy')).toBe(true)
    expect(rolesCollide('object', 'weapon')).toBe(true)
    expect(rolesCollide('weapon', 'player')).toBe(false)
    expect(rolesCollide('weapon', 'weapon')).toBe(false)
  })

  it('treats a guard like an enemy', () => {
    expect(rolesCollide('guard', 'object')).toBe(true)
    expect(rolesCollide('guard', 'weapon')).toBe(false)
  })
})

describe('Target tag', () => {
  const target = new BasicWorldObject('t', 'room', { name: 't', role: 'object', colliderTags: [{ class: 'target' }] }, [], {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  })

  it('is read back from the object metadata', () => {
    expect(colliderTagsOf(target)).toEqual([{ class: 'target' }])
  })

  it('collides with nothing, not even Obstacles or Characters', () => {
    for (const role of ['player', 'enemy', 'weapon', 'object'] as const) {
      expect(collidesPhysically(target, objectWithRole(role))).toBe(false)
      expect(collidesPhysically(objectWithRole(role), target)).toBe(false)
    }
    expect(collidesPhysically(target, target)).toBe(false)
  })

  it('is not stopped by walls, like floor objects, while solid tags are', () => {
    expect(isSolidTagged(colliderTagsOf(target))).toBe(false)
    expect(isSolidTagged([{ class: 'floor' }])).toBe(false)
    expect(isSolidTagged([{ class: 'character' }])).toBe(true)
  })
})
