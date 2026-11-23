# Game World

This context defines the language used to describe the command-driven game world.

## Language

**Room**:
A discrete game area that can be entered and revisited. It is represented through a directory-like command path. What players call a "level" (關卡) is the Room they are currently in.
_Avoid_: Folder, level (when referring to the loaded area)

**Exit**:
A route from one Room to another Room.
_Avoid_: Door (when referring to the room-to-room connection)

**Locked Exit**:
An Exit that cannot be used until its Room's goal is met, such as defeating a Guard or discovering everything in the Room. Most are shown barred; a Hidden Exit is not shown until it opens.
_Avoid_: Closed door

**Hidden Exit**:
A Locked Exit that is not shown at all until its Room's goal is met, so it appears where it is when the goal is met.
_Avoid_: Secret door, spawned exit

**Wall**:
A solid, immovable part of a Room that blocks movement, thrown objects and arrows. It is not a World Object.
_Avoid_: Obstacle (when referring to room geometry)

**Crate**:
A light World Object that can be pushed by walking into it or thrown with `acc`, heavy enough to hold a Pressure Plate down.
_Avoid_: Box

**Target Dummy**:
A World Object that nothing Collides with but that loses Health when a Weapon in flight touches it, and that is defeated at 0 Health. Its label is `dummy`. It is not a Character and not the tutorial1 training dummy, which is a passive Guard that Characters do Collide with.
_Avoid_: Training dummy (that names the tutorial1 Guard), scarecrow

**Pressure Plate**:
A World Object on the floor that is pressed while a Character or an Obstacle stands on it; it can hold an Exit shut.
_Avoid_: Switch, button

**Archer**:
A hostile Character that stands still and shoots arrows at the Player Character.
_Avoid_: Ranged guard

**Arrow**:
A projectile shot by an Archer that stops at the first Wall, Obstacle or Character it reaches and hurts a Character it hits. The player cannot list or name arrows.
_Avoid_: Bullet

**Tutorial Room**:
One of the Rooms played before room that each teach one mechanic and have a Locked Exit until the player has used it.
_Avoid_: Level, demo (when referring to these rooms in the game)

**World Object**:
An entity that exists in a room and has metadata and runtime state. It is not a literal file, and some of its metadata is not exposed through player commands.
_Avoid_: File

**Character**:
An individual person depicted in the game world, such as a player figure or a guard. The term names the depicted person without specifying control, behavior, or how the game represents them internally.
_Avoid_: Sprite (when referring to the person)

**Player Character**:
The Character controlled by the person playing the game.
_Avoid_: Player (when referring to the in-world Character)

**Guard**:
A hostile Character that obstructs the player's progress through a Room.
_Avoid_: Enemy sprite (when referring to the character)

**Weapon**:
A World Object that a Character can equip and use to defeat another Character.
_Avoid_: Equipment (when referring specifically to an object used in combat)

**Health**:
The amount of damage a Character can take before being defeated.
_Avoid_: HP, life (when referring to the glossary term)

**Reach**:
The greatest gap between a Character and a target at which an attack or pick-up can affect that target.
_Avoid_: Range, hitbox

**Impact Cooldown**:
The game time that must pass after a target takes Impact Damage before the same target can take it again.
_Avoid_: Attack Cooldown (that is the attacker's wait between its own attacks)

**Attack Cooldown**:
The time a Character must wait after an attack before attacking again.
_Avoid_: Delay

**Discovery**:
The player's in-world knowledge that a World Object exists.
_Avoid_: View visibility (when referring to the player's knowledge)

**Virtual Path**:
A command-facing address that resolves to a room or world object inside the game.
_Avoid_: File path, filesystem path (when referring to the host computer)

**Throw**:
The flight of a World Object from where it is towards a target after the player accelerates it with `acc`. It ends when the object arrives at the target or at its first Collision; an object that would Collide on the way never reaches the target. Weapons can fly out of the Room; other World Objects are stopped by the edge, which also ends their Throw.
_Avoid_: Shot, launch

**Mv Limit**:
How many more times a World Object can be the source of a Throw. Each `acc` that throws it uses one; when none are left it is Destroyed as soon as its Throw ends, or when it is next thrown. `-1` means no limit and never changes. A Weapon has 1, everything else `-1`.
_Avoid_: Durability, ammo

**Destroyed**:
Removed from its Room for good because its Mv Limit ran out. Unlike a defeated Character, a Destroyed object can no longer be named, so it is neither a source nor a target of `acc`.
_Avoid_: Defeated (that is a Character losing all Health), deleted

**Mouse Target**:
The special `acc` target `$mouse`, which stands for the point in the Room under the cursor at the moment the command is submitted. It is a point, not a World Object, so it is never discovered or renamed to. Because `$mouse` always means this point, no World Object can be named `$mouse`.
_Avoid_: Cursor object, pointer target

**Collider Tag**:
A typed label on a World Object that says what kind of thing it is when it touches another object, such as Weapon, Character, Obstacle or Target. What happens on contact, and whether two objects Collide at all, depends only on the tags of the two objects.
_Avoid_: Hitbox, collision type

**Obstacle**:
A World Object, such as the boulder, that is neither a Character nor a Weapon and that Characters, Weapons and other Obstacles Collide with.
_Avoid_: Wall, solid

**Force**:
A push applied to a World Object for one tick. All movement of a World Object (walking, pursuing, an `acc` Throw) is made of Forces, which add up.
_Avoid_: Speed (when referring to the cause of movement)

**Friction**:
The slowing of a World Object by the ground, as a share of its speed per second. It does not act while the object is in a Throw. Characters' own braking (`frictionAcceleration`) is not Friction.
_Avoid_: Drag (when referring to the ground; drag acts in the air too)

**Collision**:
A touch in which two World Objects push each other apart and exchange motion according to their mass and Restitution. A touch that only triggers an effect, such as Impact Damage, is not a Collision.
_Avoid_: Contact (when the objects exchange motion)

**Collider Shape**:
The outline a World Object collides with: a box (the default) or a circle. A circle matches a round object, so others slide around it instead of catching on corners.
_Avoid_: Hitbox (when referring to the outline's form)

**Restitution**:
How much of the speed with which two objects approach each other is returned after they Collide. The value for a Collision is the product of both objects' values.
_Avoid_: Bounciness, elasticity

**Impact Damage**:
The Health a Weapon in flight takes from a Character or Target Dummy it touches, in proportion to the Weapon's speed. The same target can take it again once the Impact Cooldown has passed, even within one Throw. It is distinct from the damage of an attack.
_Avoid_: Collision damage, throw damage

**Wildcard**:
A `*` in a Command argument that stands for any run of characters (including none). It is matched against World Object names, not expanded into the typed command.
_Avoid_: Glob (when referring to the in-game `*`)

**Process Definition**:
A reusable description of a behavior that a world object's rules may select.
_Avoid_: Process (when referring to a reusable description)

**Process Instance**:
One runtime execution of a process definition, associated with a world object and having its own lifecycle.
_Avoid_: Process definition

**Simulation Tick**:
A discrete step in which each active Behavior Rule runs its selected process logic for a World Object.
_Avoid_: Frame (when referring to game logic rather than drawing)

**Behavior Rule**:
A condition associated with a world object that selects a process definition.
_Avoid_: File content (when referring to the rule itself)

**Behavior Tree**:
A hierarchical decision tree of composite, decorator, condition, and action nodes that evaluates during a Simulation Tick to select Character behaviors.
_Avoid_: Script, state machine (when referring to the hierarchical behavior tree)

**Command**:
An implemented, allow-listed operation that a player submits to affect or inspect the game world.
_Avoid_: Shell command (when referring to execution on the host computer)

**Command Input**:
A field where the player enters one command. Long commands wrap visually but are still submitted as one command.
_Avoid_: Terminal (when referring to the input field)

**Movement Mode**:
The input state in which keyboard input moves the Player Character and the Command Input does not accept text. It is the state at game start.
_Avoid_: Walk mode, game mode

**Command Mode**:
The input state in which the Command Input accepts text and the Player Character cannot move. Time in the game world runs slower than in Movement Mode.
_Avoid_: Typing mode, terminal mode

**Command Typing Mode**:
The player's setting for how Command Mode is entered and left: Hold Shift, Enter + Sticky, or Hybrid (both ways available at once, where the key that opened the Command Input decides how it closes).
_Avoid_: Input mode (that names Movement Mode and Command Mode)

**Pause Menu**:
The overlay that suspends the game world and offers Resume, Setting, Help and Title. Choosing Title abandons the current run but leaves the Save Slot untouched.
_Avoid_: Esc menu, game menu

**Time Scale**:
The speed at which game-world time runs relative to real time, determined by the current input state.
_Avoid_: Frame rate (when referring to the speed of game-world time)

**Save Slot**:
The single place where the game keeps one saved record of the world. Saving again replaces the previous record.
_Avoid_: Save file, checkpoint (when referring to the place the record is kept)

**Save Point**:
A moment in play at which the game writes the Save Slot. Entering a Room is a Save Point.
_Avoid_: Autosave (when referring to the moment itself)

**Room Reset**:
The player's own choice, without being defeated, to put the current Room back as it was when the Player Character entered it. It returns to the Save Slot's record without replacing it, and leaves the player's settings alone. When the Save Slot holds no record it starts the game over from the beginning. It is not a Game Over Choice, which is offered only after defeat.
_Avoid_: Restart (that names the Game Over Choice), retry, level restart

**Game Over Choice**:
An option offered when the Player Character is defeated: restart from the beginning, or return to the Save Slot's record.
_Avoid_: Continue, retry

**Command History**:
The raw command text the player has submitted.
_Avoid_: Command result log

**Command Feedback**:
A result shown in the game view, either attached to a specific world object or shown as a general message.
_Avoid_: Terminal output
