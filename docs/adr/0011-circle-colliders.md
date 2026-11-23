---
status: accepted
---

# Circle colliders beside boxes, resolved along the contact normal

The boulder's sprite is round, but its collider was a square box, so Characters and thrown Weapons were stopped by the empty corners of that box and could not slide around the rock. ADR 0007 kept collision rectangular and said to reconsider "when collision needs non-rectangular shapes"; this is that case.

A collider now has a shape, `box` (the default) or `circle`. A World Object opts in with `colliderShape: 'circle'` in `room.ts`; its state then carries `shape: 'circle'` and a circle uses `colliderWidth` as its diameter (its `width` and `height` are kept equal, and the radius is half the smaller side if they ever differ). Box objects store no `shape`, so their saved form is unchanged. Only the boulder uses a circle (diameter 128, matching the visible rock in the 154 px sprite).

`AabbCollisionWorld` becomes `ShapeCollisionWorld`, still behind the `CollisionWorld` seam. Any pair with two boxes keeps exactly the old rules: axis-by-axis movement, box gap and overlap, and a Collision normal along the line between the centres. Any pair involving a circle uses `contactOf`, which gives the signed separation and the contact normal for circle–circle and circle–box (including a circle whose centre is inside a box). For such pairs the body first moves to its target and is then pushed out of each circle-involved obstacle along the contact normal, so it slides around the curve; it may not move deeper into something it already overlapped, and a final check falls back per axis so a step never ends inside something it was clear of. The physics step uses the contact normal for the Collision response and for pushing apart bodies that already overlap. The Level Editor draws circle colliders as circles, keeps their width and height locked as one diameter, checks placement with the same shape-aware overlap, and writes `colliderShape` back to `room.ts`.

Keeping box pairs on the old code means existing behaviour and tests are unchanged and only the boulder feels different. Rejected alternatives: shrinking the boulder's box (the corners still catch, and the sides let bodies overlap the rock), general convex polygons with SAT (more code than one round rock needs), and moving to Phaser Matter (rejected for the reasons in ADR 0007 and ADR 0010). The save schema version is raised to 3 because a saved boulder from schema 2 has no shape.
