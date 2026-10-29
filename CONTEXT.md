# Game World

This context defines the language used to describe the command-driven game world.

## Language

**Room**:
A discrete game area that can be entered and revisited. It is represented through a directory-like command path.
_Avoid_: Folder, level (when referring to the loaded area)

**Exit**:
A route from one Room to another Room.
_Avoid_: Door (when referring to the room-to-room connection)

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

**Attack Cooldown**:
The time a Character must wait after an attack before attacking again.
_Avoid_: Delay

**Discovery**:
The player's in-world knowledge that a World Object exists.
_Avoid_: View visibility (when referring to the player's knowledge)

**Virtual Path**:
A command-facing address that resolves to a room or world object inside the game.
_Avoid_: File path, filesystem path (when referring to the host computer)

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

**Time Scale**:
The speed at which game-world time runs relative to real time, determined by the current input state.
_Avoid_: Frame rate (when referring to the speed of game-world time)

**Command History**:
The raw command text the player has submitted.
_Avoid_: Command result log

**Command Feedback**:
A result shown in the game view, either attached to a specific world object or shown as a general message.
_Avoid_: Terminal output
