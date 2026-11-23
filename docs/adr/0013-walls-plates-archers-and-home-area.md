---
status: accepted
---

# Walls, crates, pressure plates, archers, and an area that teaches by layout

After the tutorial the player needs places to practise without being told what to do. That needs more than open rooms: solid geometry to shape a room, objects to push and stand on, and an enemy that must be dealt with from a distance.

Walls are part of a Room (`Room.walls`), not World Objects, because the player should never list, name or move them. The physics step treats them as immovable obstacles for every solid body; floor objects (pressure plates) and untagged objects (arrows) ignore them in the physics, and arrows check them themselves. Hitting a wall ends a Throw, as any Collision does. Pathfinding is not part of this: guards still steer straight, so room layouts keep their routes open.

A crate is just an Obstacle with a small mass, so the existing physics and `mv` already make it pushable and throwable. A pressure plate is a World Object with a new `floor` Collider Tag that nothing collides with; it is pressed while a Character or an Obstacle overlaps it, worked out when asked rather than stored, so it can never go stale. An Exit can require plates to be pressed (`pressed`), and an Exit's `requires` may now be a list. A plate that is released locks the Exit again, so standing on it yourself is never enough when the Exit is somewhere else.

An archer is an enemy with its own process instead of the guard's. Its arrows are pooled World Objects created with it (three each), alive only in flight and hidden from `ls`, Tab and `mv`, because the view creates sprites when a scene mounts and the save format already covers World Objects. Arrows move in their own process along a straight line, outside the force-based physics: they are not pushed, do not push, and stop at the first wall, room edge, Obstacle or Character other than their archer. They hurt any Character they hit, enemies included. This makes crates, boulders and walls into cover, and lets the player turn an archer against its own guards.

The home area (storage, yard, lane, gate) sits between the tutorial and room and has no hint banners. Each room poses one problem its layout makes solvable: a wall with a crate in its only gap, a plate that needs a crate on it, an archer across a yard of pillars, an archer behind a window over a plate that only the boulder can hold down (so moving the boulder with `mv` is also what blocks its arrows), and a final room that combines guards, an archer and a plate. Archers have a 1300 px range so every room's entrance is out of reach, and arrows do 15 damage every 1.5 s so being caught in the open is costly but not instantly fatal.

Alternatives were walls as World Objects (they would show up in `ls` and could be thrown), arrows in the physics step (every arrow would be a body to push and be pushed, and Collisions would end other objects' Throws), and creating arrows on demand (the view and the save format would need dynamic objects for the first time).
