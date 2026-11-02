---
status: accepted
---

# Collider Tags on objects, contact rules in one resolver

What happens when two World Objects touch is decided by the Collider Tags they carry, not by each object's own process and not by a switch over concrete object types. A Collider Tag is typed data (`{ class: 'weapon', impactDamageRate }`, `{ class: 'character' }`) kept in the object's metadata. One generic `ContactResolver` finds Thrown objects that overlap other objects and dispatches the rule registered for each pair of tag classes; today there is one rule, a Thrown Weapon hurting a Character (Impact Damage, once per Throw per Character, the weapon unchanged).

We rejected a central switch over concrete types because it grows with every object kind (n² branches) and every new kind edits the same file. We rejected "each object decides" because a symmetric touch has no natural owner (does the dagger or the guard handle it?), results depend on which object's process runs first, and an object that tests for other kinds by name ends up knowing all of them anyway. Rules keyed by tag class stay sparse (only pairs that do something), a new kind just carries existing tags, and the effect is owned by the acting side with one fixed order.

Reconsider if interactions need rich per-object state machines (the guard's pursuit and attack stay in its process for that reason) or if rules need information a tag cannot carry. Tags are derived from `role` when objects are built and are not yet editable or stored in `room1.ts`. High speeds can tunnel through a Character because overlap is tested once per tick, not swept.
