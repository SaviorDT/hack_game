---
status: accepted
---

# Room travel, locked Exits and tutorial rooms

The game had one playable room: reaching its Exit ended the run, every process only ran in room1, and an object's room could not change. To teach the mechanics before room1, and to prepare for a larger map later, the player now travels between Rooms.

A Room may name an `entry` point, a `hint`, a `goal` and whether entering `restoresHealth`. An Exit may `require` something before it opens (every listed object defeated, or everything discoverable in the room discovered) and may `endsGame` (room1's Exit to room2 keeps the old ending). `domain/RoomTravel.ts` owns the rules, and Room transitions occur only by walking into an open Exit zone. The removed `cd <room>` command is not a gameplay teleport or alternate room-travel path. Travelling moves the Player Character's id between the rooms' `objectIds` and changes its `roomId`, which becomes mutable for this alone. Processes run for objects in the current room instead of only in room1.

A held Weapon stays behind in the room being left. Objects belong to their room the way files belong to a directory, and it keeps names unique within a room, so each room can have its own `dagger` without `mv dagger …` becoming ambiguous. Entering a room is the first Save Point, so a defeat in room1 does not send the player back through the tutorial.

Four tutorial rooms come first, one per mechanic: moving and attacking (a passive training dummy), `ls` and Discovery, `mv` throws, and Command Mode's slowed time (a guard faster than the player). Each Exit is locked until the room's mechanic has been used, each room shows its hint in a banner, and the HUD shows the goal. The tutorial world is separate from `createInitialWorldState`, so room1 alone (the editors and their sessions) is unchanged. In the throwing rooms the player picks up the dagger and throws it with `mv`.

Alternatives were a separate tutorial mode reached from a menu (the player could skip it, and it would not build the room chain a larger map needs), teleporting via a command from anywhere (no reason to walk the room), and carrying held items between rooms (names in the new room could clash, and a thrown-away dagger would leave later rooms unwinnable).
