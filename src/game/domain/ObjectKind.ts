/**
 * Not a generated file. `room.ts` and `Prefab.ts` are overwritten whole by the editors' save, so a type
 * that other modules import has to live here, not there. (`room.ts` repeats this union in its own
 * generated `RoomObjectConfig`; `ObjectKind.test.ts` keeps the two equal.)
 */

/** The special objects a room can hold besides the plain boulder, dagger, guard and player. */
export type ObjectKind = 'crate' | 'plate' | 'archer' | 'dummy'
