---
status: accepted, supersedes the "once per Throw" rule of 0008
---

# Impact Damage repeats on a cooldown, and a Target tag takes it without Colliding

ADR 0008 let a Weapon in flight hurt each Character at most once per Throw (`thrown.hitIds`, reset by every new `mv`). A Target Dummy with 1000 Health, which a dagger flies through without stopping, needs the opposite: a Throw that stays among a target (for example `mv dagger hacker` while the player keeps walking, so the dagger never arrives) should keep hurting it.

Two changes, both made for every target, not only the dummy:

- **Impact Cooldown.** Impact Damage is no longer limited to one hit per Throw. A target that took it is spared for `IMPACT_COOLDOWN_MS` (500 ms of game time, so Command Mode's slower time also stretches it) and can then take it again, even within the same Throw. The cooldown belongs to the target (`lastImpactTick` in its state, compared with `simulationTick`), not to the Throw, so a new `mv` does not reset it and `hitIds` is gone. A second `mv` made less than 500 ms after a hit can therefore do no damage; that is accepted. A touch that does no damage (zero speed) starts no cooldown. Guards and archers now take repeated grazes from one long Throw too.
- **`target` Collider Tag.** A World Object tagged `{ class: 'target' }` collides with nothing (it is in no `collidesPhysically` pair and walls do not stop it), so it never counts as an obstacle for `mv`, yet `weaponHitsTarget` (the same damage as `weaponHitsCharacter`) hurts it. It is not a Character, because Characters Collide with the player and the boulder. Its Health reuses `CharacterState` (`health`, `maxHealth`, `alive`), so `defeat` Exit requirements and the health bar work unchanged.

Alternatives were giving the cooldown to the Throw (a new `mv` would reset it, and the dagger would hit every 0.5 s of one flight only), keeping "once per Throw" and letting only the dummy have a cooldown (two damage rules for the same touch), and making the dummy a `floor` object (plates would then be hurt by daggers too, or `floor` would need a second meaning).

Reconsider if guard fights become too easy because a dagger can stay inside a guard, or if more kinds of hurtable, non-colliding things need different damage rules.
