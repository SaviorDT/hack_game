---
status: accepted
---

# Domain-owned AABB collision behind a seam

Collision, Reach checks, and nearest-target selection use axis-aligned boxes computed in the domain layer behind a `CollisionWorld` interface, not Phaser Arcade Physics. Arcade bodies live on Phaser Game Objects, which would force two-way position syncing each tick against the Phaser-independent world state of ADR 0001, duplicate the Time Scale of ADR 0005, and make logic tests start Phaser. Arcade also offers overlap but not the edge-gap distance that Reach needs. Phaser remains the renderer for sprites, effects, animation, and input.

Reconsider when collision needs non-rectangular shapes, many bodies, or chained pushing. Because only the interface is visible to the rest of the domain, an Arcade or Matter implementation can be placed behind it. Obstacles, triggers, and pushing are not implemented yet; this decision covers boundary clamping, edge-gap distance, and nearest-target selection.
