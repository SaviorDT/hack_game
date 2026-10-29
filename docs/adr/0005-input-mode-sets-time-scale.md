---
status: accepted
---

# Input mode sets the simulation Time Scale

The game has two input states: Movement Mode, where keys move the Player Character, and Command Mode, where the Command Input accepts text and the Player Character cannot act. Enter switches between them, and a submitted command returns to Movement Mode unless the command says otherwise. The world never pauses: Command Mode scales simulation time to 0.25 through the simulation clock, so typing a command costs the player time pressure instead of freezing the guard. This replaces the 100 ms tick of ADR 0004 with fixed `1000 / 60` ms ticks, so continuous WASD movement is smooth.

## Considered Options

- Pause the world in Command Mode: rejected because it removes the tension the mode switch is meant to create.
- Keep the 100 ms tick: rejected because continuous movement would step visibly.

## Consequences

Visual effects and animations must read the current Time Scale, or they will keep playing at full speed while the world is slowed.
