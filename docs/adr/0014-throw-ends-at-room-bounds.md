---
status: accepted, adds to the Throw end rules of 0009 and 0010
---

# A Throw also ends when the room edge stops the object

A Throw used to end only on arrival, on a Collision, or on a Wall hit. The room bounds only clamped the position and zeroed the speed into the edge, so they never ended it. That was harmless while every target was inside the room, but the Mouse Target (`mv x $mouse`) can be a point outside the room, where the cursor is over the letterbox. The object was then pulled against the edge forever: it could never arrive and there is no flight timeout.

`PhysicsWorld` now reports a room-bounds clamp through the same `onWallHit` listeners as a Wall, and `MvDrive` ends the Throw there (speed kept as zero into the edge, nothing discovered). This applies to every Throw, not only to the Mouse Target, so there is one rule: anything solid that stops a thrown object ends its Throw. Existing targets lie inside the room, so their behavior is unchanged.

Alternatives were clamping the Mouse Target into the room when it is submitted (rejected: the player aimed at that point, and the object should fly towards it and be stopped by the edge), applying the rule only to Throws at the Mouse Target (two rules for the same situation), and a general flight timeout (a new tunable that hides the cause, and a thrown object would stop in mid-air instead of at the edge). A timeout is still missing for a `mv_acceleration` or `max_velocity` of 0, which this decision does not address.
