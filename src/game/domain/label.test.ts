import { describe, expect, it } from 'vitest'
import { assertValidLabel, hasUppercase } from './label.ts'
import { BasicWorldObject } from './BasicWorldObject.ts'
import { assertValidRoom, assertValidRoomExit, type RoomExit } from './Room.ts'
import { createGameWorldState } from '../content/tutorialRooms.ts'
import { ROOM1_OBJECTS } from '../content/room1.ts'
import { createInitialWorldState } from '../content/room1WorldState.ts'

describe('label validation', () => {
  it('detects uppercase letters correctly', () => {
    expect(hasUppercase('hacker')).toBe(false)
    expect(hasUppercase('dagger')).toBe(false)
    expect(hasUppercase('guard_0')).toBe(false)
    expect(hasUppercase('room-2')).toBe(false)
    expect(hasUppercase('Hacker')).toBe(true)
    expect(hasUppercase('DAGGER')).toBe(true)
    expect(hasUppercase('roomTwo')).toBe(true)
  })

  it('assertValidLabel throws on uppercase letters and passes on lowercase', () => {
    expect(() => assertValidLabel('hacker')).not.toThrow()
    expect(() => assertValidLabel('guard_1', 'object name')).not.toThrow()
    expect(() => assertValidLabel('Hacker', 'object name')).toThrow(
      'Invalid object name: "Hacker" must not contain uppercase letters.',
    )
  })

  it('enforces lowercase labels on WorldObject construction and rename', () => {
    expect(
      () =>
        new BasicWorldObject(
          'test_obj',
          'room1',
          { name: 'InvalidName' },
          [],
          {},
        ),
    ).toThrow('Invalid world object name: "InvalidName" must not contain uppercase letters.')

    expect(
      () =>
        new BasicWorldObject(
          'UpperId',
          'room1',
          { name: 'valid_name' },
          [],
          {},
        ),
    ).toThrow('Invalid world object id: "UpperId" must not contain uppercase letters.')

    const obj = new BasicWorldObject(
      'valid_obj',
      'room1',
      { name: 'valid_name' },
      [],
      {},
    )
    expect(() => obj.rename('ValidRenamed')).toThrow(
      'Invalid world object name: "ValidRenamed" must not contain uppercase letters.',
    )
    expect(() => obj.rename('valid_renamed')).not.toThrow()
    expect(obj.metadata.name).toBe('valid_renamed')
  })

  it('enforces lowercase labels on RoomExit and Room', () => {
    const invalidExit: RoomExit = {
      targetRoomId: 'room2',
      label: 'Room2',
      x: 100,
      y: 100,
    }
    expect(() => assertValidRoomExit(invalidExit)).toThrow(
      'Invalid room exit label: "Room2" must not contain uppercase letters.',
    )

    const validExit: RoomExit = {
      targetRoomId: 'room2',
      label: 'room2',
      x: 100,
      y: 100,
    }
    expect(() => assertValidRoomExit(validExit)).not.toThrow()

    expect(() =>
      assertValidRoom({
        id: 'room1',
        objectIds: [],
        exits: [invalidExit],
        state: {},
      }),
    ).toThrow('Invalid room exit label: "Room2" must not contain uppercase letters.')
  })

  it('enforces that all actual game rooms and objects have zero uppercase labels', () => {
    const worldState = createGameWorldState(ROOM1_OBJECTS)
    for (const room of worldState.rooms) {
      assertValidRoom(room)
    }
    for (const obj of worldState.worldObjects) {
      assertValidLabel(obj.id, `world object id in ${obj.roomId}`)
      if (typeof obj.metadata.name === 'string') {
        assertValidLabel(obj.metadata.name, `world object name in ${obj.roomId}`)
      }
    }

    const initialRoom1 = createInitialWorldState(ROOM1_OBJECTS)
    for (const room of initialRoom1.rooms) {
      assertValidRoom(room)
    }
    for (const obj of initialRoom1.worldObjects) {
      assertValidLabel(obj.id, `room1 world object id`)
      if (typeof obj.metadata.name === 'string') {
        assertValidLabel(obj.metadata.name, `room1 world object name`)
      }
    }
  })
})

