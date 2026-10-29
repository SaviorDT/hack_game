---
status: accepted
---

# Interaction does not depend on Discovery

A World Object that the player has not discovered with `ls` is hidden in the view only. The Player Character can still pick it up or be attacked by it, and doing so marks it as discovered. `ls` remains the way to reveal everything discoverable in a Room at once and to make those objects available to tab completion. Gating interaction on Discovery was rejected because Movement Mode lets the player walk into any object, and an invisible, untouchable dagger would feel like a bug rather than a mechanic.
