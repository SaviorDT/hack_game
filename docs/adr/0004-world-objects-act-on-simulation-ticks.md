---
status: accepted
---

> The 100 ms tick length is superseded by ADR 0005, which uses fixed `1000 / 60` ms ticks. The rest of this decision stands.

# Advance world objects on simulation ticks

The simulator advances in fixed 100 ms ticks, evaluates each World Object's Behavior Rules, and runs the process logic for each matching rule. Commands set world state or object intent synchronously; the simulator then moves and reacts to that state independently of rendering, so movement, pickup, guard pursuit, combat, and room transitions are determined by object rules.
