# Game Architecture

## Scope

Architecture specification for the command-driven RTS game and initial room (Vite, TypeScript, Phaser 4.2.1).

## Architectural Decisions

- **Phaser Scene**: `GameScene` owns the Phaser runtime scene, hosting in-view command input and feedback.
- **Viewport Scaling**: 1920×1080 scene with Phaser `FIT` scaling, centered with dark letterboxing; no browser fullscreen.
- **Authoritative Model**: Domain state is authoritative in TypeScript; Phaser objects strictly render domain state.
- **Virtual Hierarchy**: Virtual paths (`Room`, `WorldObject`) are domain metaphors; no OS filesystem or host shell access.
- **Command Whitelist**: Only registered virtual command executors run, one per line (no pipes, chaining, or scripting).
- **Execution & Simulation**: Commands run synchronously; autonomous behavior advances in fixed simulation ticks (input mode sets Time Scale, ADR 0005).
- **Process Model**: `ProcessDefinition` is reusable behavior; `ProcessInstance` tracks runtime state per world object.
- **Tick Engine**: `TickSimulationEngine` accumulates time into fixed 60 Hz (`1000/60` ms) ticks, running matching behavior processes per object in stable order.
- **Collision & Reach**: Domain AABB logic (`CollisionWorld`) handles collision, reach, and targeting without Phaser physics (ADR 0007). Interaction ignores Discovery (ADR 0006).
- **Persistence**: `SaveRepository` (`LocalStorageSaveRepository`) stores snapshots with domain state and command history.

## Runtime Responsibilities

### Phaser Scene

`GameScene` (1920×1080 reference space) mounts Room 1 domain state, session, room/object views, input, feedback, and outcome panels, forwarding Phaser's frame delta to `GameSession`. `createGame` boots with `GameScene`.

`PhaserCommandInputView` sits bottom-center. In Command Mode, it accepts printable ASCII, cursor editing, auto-wrapping, and history navigation; Enter submits. In Movement Mode, it is dimmed with a typing prompt hint. `PhaserRoomView` projects world objects to Phaser sprites and overhead labels (`?` for undiscovered objects, object name once revealed, and `hacker` for the player character; equipped items remain visible with label scale shrunk to `ITEM_LABEL_WIDTH_RATIO` [0.75] of item sprite width to avoid overlapping the character); `PhaserGameOutcomePanel` displays Game Over / Congratulations states.

### Input Modes

| Mode | Time Scale | Player Control | Combat & Actions |
|---|:---:|---|---|
| **Movement** | 1.00 | Arrows (responsive physics) | Space / Left-click: attack (auto-pickup on contact) |
| **Command** | 0.25 | Disabled (or latched direction) | Ignored |

- **Shell Entry & Exit**: Typing any alphabet key (`[a-zA-Z]`) while in Movement Mode directly enters Command Mode and begins typing the command. Pressing Escape in Command Mode immediately exits Command Mode and clears any unsubmitted command draft.
- **Submission**: Commands submitted with Enter execute and switch back to Movement Mode (unless `inputAfter` overrides).
- **Latched Movement**: Typing an alphabet while holding movement keys latches velocity until collision, room exit, or Escape/submission; latched keys are suppressed from typing input.
- **Prompt**: Displays active room path.

### Command Input Behavior

- **Tab Completion**: Tab on empty input completes `help`; otherwise completes registered commands and discovered room entries. Unique matches append a trailing space; ambiguous matches complete the common prefix.
- **Discovery Gate**: Undiscovered objects require discovery (`ls` or direct interaction) before autocomplete inclusion.
- **History & Editing**: `Ctrl+Backspace` deletes previous word; `Up`/`Down` navigates command history (down past newest restores draft).

### Application Session & Command Pipeline

`GameSession` orchestrates `WorldState`, input mode, player actions, command execution, and simulation ticks.

Synchronous submission pipeline:
1. `VirtualCommandParser`: Parses raw input into command, options, arguments.
2. `RegisteredCommandRegistry`: Resolves command name against allow-list.
3. `CommandRequirementChecker`: Validates requirements against world state.
4. `CommandExecutor`: Synchronously updates domain state.
5. `CommandResult`: Emits object-attached or general feedback.

### World and Process Model

- `WorldState`: Root aggregate for rooms, world objects, active process instances, current room, simulation tick, outcome, and command history.
- `Room`: Enterable area owning exits.
- `WorldObject`: Domain entity with identity, room ID, metadata, behavior rules, and runtime state.
- `BehaviorRule`: Maps object condition to `ProcessDefinition`.
- `VirtualWorldPathResolver`: Resolves virtual command paths to room/object IDs (no host filesystem access).

### Simulation Time

`RealtimeSimulationClock` scales Phaser frame delta by active Time Scale (max 250 ms real delta clamped per frame). `TickSimulationEngine` accumulates game delta into fixed 60 Hz ticks. `GameSession.getRenderPosition` interpolates object positions between ticks for smooth visual rendering decoupled from tick rate.

### Combat and Collision

Characters start with 100 Health. Weapon definitions scale cooldowns with simulation time:

| Weapon | Damage | Cooldown | Reach | Notes |
|---|:---:|:---:|:---:|---|
| Unarmed | 10 | 0.5s | 5 px | Default when unarmed |
| Dagger | 35 | 0.5s | 10 px | Single-target |
| Guard | 20 | 1.0s | 5 px | Hostile guard attack |

Attacks damage nearest character within Reach (bounding-box gap). Items (including Dagger) are automatically picked up when within `PICKUP_REACH = 10` px; both actions mark undiscovered targets discovered. Hitboxes scale proportionally via `scaleX`/`scaleY` from base dimensions (`CHARACTER_SIZE` 110×160, `DAGGER_SIZE` 72×72).

### First Room Behavior

Room 1 initializes with Player Character (upper-left, named `hacker`), Dagger (lower-left), and Guard (right). All World Object sprites are shown by default. Exiting right leads to Room 2:
- Undiscovered world objects display a `?` overhead label at the top of their sprite; the player character displays `hacker` and is never `?`.
- `ls` discovers objects in the room and reveals their `?` labels to their respective names; direct player interaction (picking up an item or attacking a guard) also marks the target object discovered, while guard movement/pursuit and guard attacks do not discover the guard.
- `mv <label1> <label2>` throws `<label1>` towards `<label2>` (an object or room exit) with speed `mv_speed` (`DEFAULT_MV_SPEED` 300 px/s in `src/game/commands/mvConstants.ts`, constant across all rooms), unequipping it if equipped. If `<label2>` does not exist in the room, it renames `<label1>` to `<label2>` and marks it discovered.
- `mv` Wildcard source: a `*` in `<label1>` (any run of characters, case-insensitive, any position, repeatable) is matched against the display names of every object in the current room (ignoring Discovery, player included). The typed command is not expanded; `<label2>` is always literal, so names may contain `*`. The target object is excluded from the matches (no same-object error); zero matches rejects with `Cannot find "<pattern>".`. With an existing target all matches are thrown and reported in one popup (`Threw a, b to target.`). With a non-existent target a single match is renamed to the plain target name, while two or more are renamed `<target>_0`, `<target>_1`, … (the counter skips names taken by non-source objects, exit labels or exit target room ids, and continues across sources).
- The player walks with Arrows, automatically picks up the Dagger (and any items) on contact/reach, and attacks with Space or left click. Typing any alphabet key directly switches to Command Mode and begins entering a command.
- Guard pursues player when player enters room's right half; attacks within Reach.
- Player reaching 0 Health triggers `game-over`. Defeating guard stops pursuit. Reaching exit triggers `congratulations`.

### Persistence

`WorldStateCodec` converts between `WorldState` and `WorldStateSnapshot`. `SaveSnapshot` (`schemaVersion` 1) bundles domain state and raw command history into `LocalStorageSaveRepository`, which holds exactly one Save Slot (default key `hack-game.save`; Speed and AI editor sessions use `hack-game.editor-save` so they never touch the game's slot).

#### Save API (`GameSession`)

| Method | Behavior |
|---|---|
| `saveCurrentState()` | Writes the current world to the Save Slot, replacing any prior record. |
| `hasSavedState()` | `true` only if the slot holds a readable snapshot with the current `schemaVersion`; corrupt JSON counts as no save (never throws). |
| `loadSavedState()` | Hydrates the snapshot over the live `WorldState` in place and returns `true`; returns `false` and changes nothing if there is no usable save. Restores positions, health, equipment, process instances, `simulationTick` and `commandHistory`; forces `outcome = 'playing'`, releases held keys and enters Movement Mode (unsent command drafts are dropped by the scene).|

**Nothing calls `saveCurrentState()` yet.** No Save Point is defined; to add one, call `session.saveCurrentState()` at the desired moment (e.g. in `GameScene` or a simulation process). Until then `hasSavedState()` is `false`, so the Game Over "LOAD SAVE" choice is disabled. A fresh page load always starts a new game; there is no "continue" entry point.

### Game Over Choices

When `outcome === 'game-over'`, `PhaserGameOutcomePanel` shows two buttons below the message: `RESTART` and `LOAD SAVE`. Selection state lives in `GameOverMenu` (Phaser-free, unit-tested).

- **Keyboard**: Left/Right moves the selection (wraps, skips disabled), Enter confirms. While the menu is active `GameScene.handleKeyDown` swallows all other keys, so letters cannot enter Command Mode; if the player dies while in Command Mode the scene returns to Movement Mode and clears the draft.
- **Mouse**: hovering selects an enabled button, clicking confirms it.
- **Default selection**: `RESTART`. `LOAD SAVE` is greyed out and unselectable unless `hasSavedState()` was `true` at the moment of death.
- **Effect**: both choices call `scene.restart({ resumeFromSave })`. `RESTART` rebuilds the session from the initial Room 1 state and leaves the Save Slot untouched; `LOAD SAVE` rebuilds the session, calls `loadSavedState()` before the views mount, then plays on.

## Class Relationships

```mermaid
classDiagram
  PhaserScene <|-- GameScene
  PhaserScene <|-- LevelEditorScene
  PhaserScene <|-- SpeedEditorScene
  PhaserScene <|-- BehaviorTreeEditorScene

  GameScene --> GameSession
  GameScene --> CommandInputView
  GameScene --> FeedbackView
  GameScene --> PhaserRoomView
  GameScene --> WorldObjectViewRegistry

  GameSession --> WorldState
  GameSession --> CommandSubmissionService
  GameSession --> SimulationClock
  GameSession --> SimulationEngine
  GameSession --> SaveRepository

  WorldState *-- Room
  Room *-- Exit
  WorldState *-- WorldObject
  WorldState *-- ProcessInstance
  WorldObject --> BehaviorRule
  BehaviorRule --> ProcessDefinition
  WorldObject "1" <-- "0..*" ProcessInstance : ownerObjectId
  ProcessInstance --> ProcessDefinition : definitionId

  CommandSubmissionService --> CommandParser
  CommandSubmissionService --> CommandRegistry
  CommandSubmissionService --> CommandRequirementChecker
  RegisteredCommand --> CommandExecutor
  SimulationEngine --> WorldObjectProcess

  LevelEditorScene ..> room1 : reads & overwrites ROOM1_OBJECTS
  LevelEditorScene --> EditorHistory : manages undo stack
  LevelEditorScene ..> room1Serializer : serializes RoomObjectConfig[]
  SceneManager ..> GameScene : manages transitions & hotkeys
  SceneManager ..> LevelEditorScene : manages transitions (F2 toggle / Esc)
  SceneManager ..> SpeedEditorScene : manages transitions (F3 toggle / Esc)
  SceneManager ..> BehaviorTreeEditorScene : manages transitions (F4 toggle / Esc)
  SpeedEditorScene ..> room1 : reads & overwrites ROOM1_OBJECTS
  SpeedEditorScene ..> speedEditorSession : wraps GameSession & TickSimulationEngine
  speedEditorSession --> PlayerMovementProcess : reuses main movement physics
  BehaviorTreeEditorScene ..> aiEditorSession : wraps GameSession & TickSimulationEngine
  aiEditorSession --> BehaviorTreeProcess : runs behavior tree per tick
  BehaviorTreeProcess --> BehaviorTreeEvaluator : evaluates tree hierarchy
  room1WorldState ..> room1 : constructs WorldState from ROOM1_OBJECTS
```

## Source Layout

```text
src/
  main.ts, createGame.ts
  application/  GameSession.ts, InputModeController.ts
  ai/           behaviorTree/{BehaviorTreeTypes.ts, BehaviorTreeEvaluator.ts, BehaviorTreePresets.ts, BehaviorTreeProcess.ts, BehaviorTreeModel.ts}
  content/      room1.ts, room1Constants.ts, room1Commands.ts, room1Serializer.ts, room1WorldState.ts, createRoom1Session.ts
  scenes/       GameScene.ts, SceneManager.ts, LevelEditorScene.ts, levelEditorHistory.ts, SpeedEditorScene.ts, speedEditorSession.ts, BehaviorTreeEditorScene.ts, aiEditorSession.ts
  domain/       WorldState.ts, Room.ts, WorldObject.ts, BasicWorldObject.ts, CharacterState.ts, CollisionWorld.ts, CombatService.ts, PickUpService.ts, WeaponDefinition.ts, ids.ts, JsonValue.ts, WorldPath.ts, WorldPathResolver.ts, VirtualWorldPathResolver.ts
  processes/    BehaviorRule.ts, ProcessDefinition.ts, ProcessInstance.ts
  commands/     CommandSubmissionService.ts, CommandRegistry.ts, RegisteredCommandRegistry.ts, CommandParser.ts, VirtualCommandParser.ts, CommandRequirement.ts, CommandRequirementChecker.ts, EveryCommandRequirementChecker.ts, ParsedCommand.ts, CommandHistory.ts, CommandFeedback.ts, CommandResult.ts, executors/{base.ts, help.ts, ls.ts, mv.ts}
  simulation/   SimulationClock.ts, SimulationEngine.ts, RealtimeSimulationClock.ts, TickSimulationEngine.ts, room1/Room1Processes.ts
  persistence/  SaveSnapshot.ts, SaveRepository.ts, LocalStorageSaveRepository.ts, WorldStateCodec.ts, JsonWorldStateCodec.ts
  presentation/ GameOverMenu.ts, CommandInputView.ts, PhaserCommandInputView.ts, FeedbackView.ts, PhaserFeedbackView.ts, PhaserRoomView.ts, PhaserGameOutcomePanel.ts, InputBindings.ts, WorldObjectViewRegistry.ts
assets/         fonts/, ui/, characters/{player, guard}/, items/weapons/
docs/           architecture.md, adr/0001..0007
```

## Level Editor

`LevelEditorScene` (`'level-editor'`) provides visual editing of room1 world object positions and sizes. Accessible from anywhere via **F2**; pressing **F2** or **Escape** returns to the current active playable scene (`'game'`).

Editable configurations export directly to `room1.ts` (`ROOM1_OBJECTS`). Objects use base sizes (`CHARACTER_BASE_SIZE` 176×176, `DAGGER_SIZE` 72×72) with default 1.00 scales. Editor controls dock below room view (`y = 720..1010`), leaving room area (`y = 80..700`) unobstructed. Editor navigation and hotkeys are managed centrally by `SceneManager`.

### Features & Controls

| Action | Control |
|---|---|
| **Reposition** | Drag sprite, or arrow keys (1 px, Shift: 10 px) |
| **Uniform Scale** | Drag yellow corner handle, `+`/`-` keys, or panel `×1.1` / `÷1.1` buttons |
| **Spawn / Despawn** | `+ GUARD`, `+ DAGGER` buttons; despawn with `REMOVE SELECTED` or `Del`/`Backspace` |
| **Selection** | Click sprite, panel list entry, or cycle with `Tab` / `Shift+Tab` |
| **Character Stats** | Edit guard `max_health` & `speed`, or player `max_health` (`+/-` 10, Shift: 50, click value for prompt) |
| **Speed Editor Access** | `OPEN SPEED EDITOR (F3)` button or **F3** shortcut |
| **AI Editor Access** | `AI EDITOR (F4)` button or **F4** shortcut |
| **Return to Game** | **F2** or **Escape** (exits to active playable scene) |
| **Undo / Redo** | `Ctrl+Z` reverses operations via invertible delta stack (move, scale, stat, spawn/despawn) |
| **Toggle Panel** | **P** toggles bottom property panel visibility |
| **Save** | `SAVE TO ROOM1.TS` overwrites file via `/api/save-room1` and syncs in-memory `ROOM1_OBJECTS` |

## Speed Editor

`SpeedEditorScene` (`'speed-editor'`) tunes player movement and `mv` throw physics in real time. It directly reuses main game simulation (`GameSession`, `InputModeController`, `TickSimulationEngine`, `PlayerMovementProcess`, `DaggerPickupProcess`).

### Physics Parameters

#### Player Movement Physics

| Parameter | Default | Unit | Description |
|---|:---:|:---:|---|
| `maxSpeed` | 300 | px/s | Velocity cap in movement mode |
| `acceleration` | 2500 | px/s² | Speed-up rate toward input direction |
| `frictionAcceleration` | 3000 | px/s² | Braking deceleration when movement input stops |
| `turnaroundAcceleration` | 1600 | px/s² | Snappy reversal acceleration opposing velocity |

#### MV Command Speed

| Parameter | Default | Unit | Description |
|---|:---:|:---:|---|
| `mv_speed` | 300 | px/s | Velocity for thrown objects (`mv` command, constant across all rooms in `mvConstants.ts`) |

### Features & Runtime Behavior

- **Live Tuning While Moving**: Keyboard movement (Arrows) runs continuously during mouse interaction, giving immediate tactile feedback on physics changes.
- **MV Command Tuning & Testing**: Dedicated parameter control for `mv_speed`, paired with an interactive `TEST MV (THROW DAGGER)` button to test thrown object velocity in real time.
- **Step & Direct Input**: Parameter buttons (`+` / `−` with step sizes, Shift: 5x multiplier) or click value for exact number prompt. Clamped to minimum safe values.
- **Live Telemetry**: Displays real-time player speed (`px/s`), velocity vectors (`vx`, `vy`), input direction (`moveX`, `moveY`), dynamic visual speedometer gauge, and active `mv` thrown entity telemetry.
- **Reset Position**: **R** (or `RESET POSITIONS (R)` button) snaps player and dagger back to start coordinates with zero velocity for clean trials.
- **Reset Defaults**: Restores default physics values for both player and `mv_speed`.
- **Save Changes**: `SAVE CHANGES` button writes updated player speed directly to `src/game/content/room1.ts` via `/api/save-room1` (`ROOM1_OBJECTS`) and saves `mv_speed` to `src/game/commands/mvConstants.ts` via `/api/save-mv`, syncing global runtime `GAME_MV_SPEED`.
- **Navigation**: Accessible from anywhere via **F3**; **Escape** or **F3** exits to the current active playable scene (`'game'`), **F2** opens Level Editor, **F4** opens AI Editor.

## Behavior Tree & AI System

The Behavior Tree subsystem provides hierarchical AI decision-making for guards and bosses, executing inside `TickSimulationEngine` through `BehaviorTreeProcess`.

### Node Taxonomy

| Category | Node Types | Purpose |
|---|---|---|
| **Composite** | `selector`, `sequence` | Control flow branch evaluation (`selector` falls back until success, `sequence` steps until failure) |
| **Decorator** | `cooldown`, `inverter` | Modifies or rate-limits child execution (e.g. boss charge attack every 3.5s) |
| **Condition** | `is_player_in_range`, `is_player_in_zone`, `is_health_below` | Queries world state, distance, or health ratios |
| **Action** | `chase_player`, `melee_attack`, `charge_attack`, `patrol`, `flee`, `wait`, `heal` | Mutates entity position, attacks target, activates boss abilities, or patrols |

### Node Statuses & Telemetry

Each node evaluates to one of three statuses per simulation tick:
- `SUCCESS`: Node completed its objective (e.g. strike hit, reached target range, condition true). Glows green (`#00e676`).
- `FAILURE`: Node failed or condition false (e.g. out of reach, on cooldown). Outlines red (`#ff1744`).
- `RUNNING`: Node is performing an ongoing action (e.g. chasing, dashing, waiting). Glows yellow (`#ffea00`).

### Presets

1. **Standard Guard AI** (`standard-guard`): Classic room guard that triggers when the player enters the right half of the room, pursuing and attacking.
2. **Patrol & Ambush Guard** (`patrol-guard`): Loops between waypoints until the player enters detection radius, then intercepts.
3. **Boss: Cyber Enforcer (2-Phase)** (`boss-cyber-enforcer`): Multi-phase boss with Phase 1 stalker tactics, transitioning at `<50% HP` into Phase 2 Berserk with high-speed charge dashes and 1.4x pursuit speed.
4. **Hit & Run Skirmisher** (`hit-and-run`): High-mobility skirmisher that approaches, strikes, retreats to safe distance to reset, and flees when low on health.
5. **Tank Boss** (`tank-boss`): Heavy armored boss with area patrol, high-damage melee smash, and active chassis repair when the player retreats.

## AI Behavior Tree Editor

`BehaviorTreeEditorScene` (`'behavior-tree-editor'`) provides an interactive visual editor and live simulation sandbox for boss and enemy behavior trees. Accessible from anywhere via **F4** (or the **AI EDITOR (F4)** button in the Character Stats panel).

### Editor Layout & Capabilities

1. **Upper Live Room Chamber (`y = 80..700`)**:
   - Reuses Room 1 layout and `PhaserRoomView` directly, running domain physics and combat in real-time inside `GameSession`.
   - Control player with Arrow keys. Click any enemy in the room (`guard`, `guard-2`, `guard-3`) to preview the AI Behavior Tree with that clicked enemy.
   - Live visual detection radius (cyan ring, 380px), attack reach (red ring, 60px), and active target ring rendered around the selected enemy in room coordinates.
   - Overhead action tags (`[GUARD] [CHASING]`, `[ALERTED]`, etc.) floating above the previewed enemy entity.
   - All standard Room 1 entities and obstacles rendered with full interpolation.

2. **Top Navigation & Simulation Toolbar (`y = 14..62`)**:
   - Organized in a dual-row header preventing UI overlaps:
     - Row 1 (`y = 14`): Scene title and clean navigation hotkey hints (**R** for reset, **P** for panel toggle, **F2** for Level Editor, **F3** for Speed Editor, **F4** / **ESC** for Game).
     - Row 2 (`y = 48`): Preset selector buttons (`STD GUARD`, `PATROL GUARD`, `CYBER BOSS`, `HIT & RUN`, `TANK BOSS`) with active selection highlights on the left; playback controls on the right (`PAUSE (SPC)` / `RESUME (SPC)`, `STEP (T)`, `RESET (R)`).

3. **Bottom Dock Panel (`y = 720..1015`, toggleable with P key)**:
   - **Column 1: Behavior Tree Graph Canvas**: Dynamic 2D tree layout with parent-child connection lines, execution halo glow reflecting `SUCCESS`, `FAILURE`, and `RUNNING` statuses each tick, interactive panning via drag, and `[CENTER]` button.
   - **Column 2: Tree Editing**: Palette of child node insertion buttons color-coded by category (Purple for Composites, Orange for Decorators, Blue for Conditions, Green for Actions), sibling reordering with `◄ MOVE NODE` and `MOVE NODE ►`, and `DELETE (DEL)` button (root protected).
   - **Column 3: Node Inspector & Telemetry & Actions**: Real-time telemetry (Boss HP, Phase 1 vs Phase 2, distance to player), interactive phase testing buttons (`DMG BOSS (-25)` / `HEAL BOSS (+25)`), parameter tuning buttons for selected node, `SAVE TO GAME` (writes tree into `room1.ts`), and `COPY JSON`.

### Controls & Shortcuts

| Action | Control |
|---|---|
| **Open AI Editor** | **F4** (from anywhere) or **AI EDITOR (F4)** button in Level Editor |
| **Open Level Editor** | **F2** |
| **Open Speed Editor** | **F3** |
| **Move Player in Room** | **Arrow keys** |
| **Preview AI with Enemy** | Click enemy in room chamber |
| **Toggle Bottom Panel** | **P** key |
| **Play / Pause Sim** | **Space** or `PAUSE (SPC)` button |
| **Step Sim (+33ms)** | **T** or `STEP (T)` button |
| **Reset Positions** | **R** or `RESET (R)` button |
| **Pan Tree Canvas** | Drag mouse inside Behavior Tree Graph area |
| **Center Tree Canvas** | Click `[CENTER]` button |
| **Select Node** | Click node card in graph |
| **Delete Node** | `Delete` / `Backspace` or `DELETE (DEL)` button |
| **Damage Boss (-25 HP)** | `DMG BOSS (-25)` button |
| **Heal Boss (+25 HP)** | `HEAL BOSS (+25)` button |
| **Return to Game** | **F4** or **Escape** |

## Framework References

- [Phaser Scene API](https://docs.phaser.io/api-documentation/4.0.0/class/scene) — scene lifecycle.
- [MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) — browser persistence.
