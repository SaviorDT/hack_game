---
status: accepted
---

# Throws are flown by one engine phase with force, drag and a speed cap

`mv` no longer gives a Thrown object a fixed speed that each object's process advances on its own. It records the target (`thrown`), and `TickSimulationEngine` flies every Thrown object in one place before the object processes run: move with the velocity from the previous tick, resolve contacts (ADR 0008) at that speed, then update velocity. The update is `v = v × max(0, 1 − drag × dt) + (mv_force ÷ mass) × dt × direction-to-target`, with `|v|` capped at `max_velocity`; arriving at the target snaps the object there and stops it at once. Velocity is a real vector (inertia, not steering), so a re-aimed object keeps its velocity and may overshoot.

Moving before updating velocity means contacts see the speed the object actually moved with, and the stop on arrival happens after contacts, so an arrival tick still deals damage at its pre-stop speed. `mv_force` is global; `drag`, `mass` and `max_velocity` are global defaults that each object may override in `mv_attr`, so tuning the defaults in the Speed Editor affects every object that does not override them. Player walking and guard pursuit keep their own movement and are not part of this.

Alternatives were keeping per-process thrown movement (duplicated in three processes, and no single place to run contacts at a known speed) and steering the velocity direction straight at the target (more predictable, but rejected for the inertial feel). Because nothing stops an object whose force or `max_velocity` is set to 0, a Throw can then never arrive; there is no flight timeout yet.
