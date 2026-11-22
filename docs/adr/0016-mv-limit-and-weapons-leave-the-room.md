---
status: accepted, supersedes 0014 for Weapons
---

# Mv Limit: objects can be thrown a limited number of times, and Weapons are not held by the room edge

Two changes that belong together: a thrown Weapon is meant to be spent, and a spent Weapon may be thrown out of the room.

**Mv Limit.** Every World Object carries `mvLimit` in its state: how many more times it can be the source of an `mv` Throw. `-1` means no limit and never changes; the default is 1 for a Weapon (role `weapon`) and `-1` for everything else. It can be set per object in `RoomObjectConfig` and in a prefab (and so in `room1.ts`), not yet in the editor's inspector. The rules (`domain/MvLimit.ts`):

- `mv` spends a throw when it *starts* a Throw, per source (a Wildcard source handles each match on its own). A source with `mvLimit` 0 is Destroyed instead and not thrown, and the feedback says `<name> is used up.`. A rename (the target does not exist) spends nothing. We chose "check and decrement when `mv` runs" over decrementing only once the object has really started moving: it is one place, and a Throw of distance 0 counts like any other.
- A Throw that ends for any reason (arrival, a Collision, a wall) leaves an object with `mvLimit` 0 and no Throw in flight; `MvDrive.settle`, after the contacts of the tick, destroys every such object. The effect of the touch (Impact Damage, a pushed crate) has therefore happened first. The check in `mv` also catches a re-`mv` in mid-flight.
- Destroyed means `destroyed: true` and `alive: false`: not drawn, not picked up, not a source or target of `mv`, not listed or completed. A Weapon a Character holds is let go first (`weaponId` and `equippedBy` cleared). Unlike a defeated Character, a Destroyed object loses its name too.

**Weapons ignore the room bounds.** `PhysicsWorld` gives a body tagged `weapon` no bounds, so it can fly out of the room, and crossing the edge neither clamps it nor ends its Throw (this replaces ADR 0014 for Weapons; every other body is held and stopped as before). Walls still stop a Weapon like any other body. The tag decides it, as in ADR 0008, rather than a name or a per-object flag.

The two fit because the default dagger is spent by its first Throw: it either arrives (also at a point outside the room, such as `$mouse` over the letterbox) or is stopped, and then it is destroyed, so it cannot drift away out of the room for ever. We accepted that a Weapon whose `mvLimit` was raised to `-1` and that stops outside the room is lost, and that a room with one dagger can become unwinnable once it is spent (there is no reset and no respawn yet).

Alternatives were counting Collisions instead of throws (the dagger's first Collision would destroy it, but a dagger that never touches anything would be thrown for ever), a destroy timer, only destroying on arrival (a dagger that stopped at a crate would stay as a melee weapon until its next `mv`), and a flag per object for ignoring the bounds.

Reconsider if unwinnable rooms become a problem (a respawn, or a reset of the room), if more Weapons need other limits, or if objects other than Weapons should leave the room.
